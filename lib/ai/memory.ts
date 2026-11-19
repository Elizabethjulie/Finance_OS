import { prisma } from "@/lib/db/prisma";
import type { Currency } from "@/lib/generated/prisma/client";
import type { UserFinancialMemory } from "./types";

/**
 * Builds a dense, token-minimized snapshot of the user's financial habits and goals.
 * Typical size: 50-80 tokens.
 */
export async function buildUserFinancialMemory(
  userId: string,
  currency: Currency,
  period?: { year: number; month: number }
): Promise<UserFinancialMemory> {
  // 1. Fetch user's confirmed category habits / merchant rules
  const rules = await prisma.categoryCorrectionRule.findMany({
    where: { userId },
    select: {
      keyword: true,
      category: {
        select: { name: true },
      },
    },
    take: 20, // limit to top 20 to strictly bound token footprint
    orderBy: { createdAt: "desc" },
  });

  const merchantHabits: Record<string, string> = {};
  for (const r of rules) {
    if (r.category?.name) {
      merchantHabits[r.keyword.toLowerCase()] = r.category.name;
    }
  }

  // 2. Fetch active goals summary for this currency
  const activeGoals = await prisma.goal.findMany({
    where: { userId, isArchived: false, currency },
    select: {
      name: true,
      targetAmount: true,
      startingAmount: true,
      contributions: {
        select: { amount: true },
      },
    },
    take: 3,
  });

  let activeGoalsSummary: string | undefined;
  if (activeGoals.length > 0) {
    activeGoalsSummary = activeGoals
      .map((g) => {
        const contributed = g.contributions.reduce(
          (acc, c) => acc + Number(c.amount),
          Number(g.startingAmount)
        );
        const pct = Math.min(
          100,
          Math.round((contributed / Number(g.targetAmount)) * 100)
        );
        return `${g.name} (${pct}% of ${g.targetAmount} ${currency})`;
      })
      .join(", ");
  }

  // 3. Fetch prior month's trajectory if period is provided
  let priorMonthTrajectory: string | undefined;
  if (period) {
    const prevYear = period.month === 1 ? period.year - 1 : period.year;
    const prevMonth = period.month === 1 ? 12 : period.month - 1;

    const prevBudget = await prisma.budget.findUnique({
      where: {
        userId_year_month_currency: {
          userId,
          year: prevYear,
          month: prevMonth,
          currency,
        },
      },
      select: {
        totalAllocated: true,
        categories: {
          where: { isEssential: true },
          select: { category: { select: { name: true } } },
        },
      },
    });

    if (prevBudget) {
      priorMonthTrajectory = `Prev Month (${prevMonth}/${prevYear}): Allocated ${prevBudget.totalAllocated} ${currency}.`;
    }
  }

  return {
    merchantHabits,
    activeGoalsSummary,
    priorMonthTrajectory,
    primaryCurrency: currency,
  };
}

/**
 * Serializes memory into an ultra-dense, token-minimized string for the LLM prompt.
 */
export function formatMemoryForPrompt(memory?: UserFinancialMemory): string {
  if (!memory) return "";

  const lines: string[] = [];

  const habits = Object.entries(memory.merchantHabits);
  if (habits.length > 0) {
    const habitStr = habits
      .slice(0, 15)
      .map(([k, v]) => `"${k}"->${v}`)
      .join(", ");
    lines.push(`Merchant Habits: { ${habitStr} }`);
  }

  if (memory.activeGoalsSummary) {
    lines.push(`Active Goals: ${memory.activeGoalsSummary}`);
  }

  if (memory.priorMonthTrajectory) {
    lines.push(`Prior Trajectory: ${memory.priorMonthTrajectory}`);
  }

  return lines.length > 0 ? `\n[FINANCIAL MEMORY CONTEXT]\n${lines.join("\n")}` : "";
}
