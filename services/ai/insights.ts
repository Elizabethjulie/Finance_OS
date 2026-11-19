import { prisma } from "@/lib/db/prisma";
import type { AIInsight, Currency } from "@/lib/generated/prisma/client";
import { getDashboardSummary } from "@/services/dashboard/summary";
import { getBudgetWithActuals } from "@/services/budget/budget";
import { listGoalsWithProgress } from "@/services/goal/goal";
import { buildUserFinancialMemory } from "@/lib/ai/memory";
import { generateInsightsWithMemory } from "@/lib/ai/gemini";
import type { MonthlyInsightInput } from "@/lib/ai/types";

/**
 * Loads cached monthly insights from PostgreSQL (0 tokens consumed).
 */
export async function listStoredMonthlyInsights(
  userId: string,
  params: { year: number; month: number; currency: Currency }
): Promise<AIInsight[]> {
  const { year, month, currency } = params;

  return prisma.aIInsight.findMany({
    where: {
      userId,
      year,
      month,
      currency,
      isDismissed: false,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Gathers verified deterministic financial numbers, injects user memory,
 * calls Gemini Flash with token minimization, and saves the resulting insights.
 */
export async function generateAndSaveMonthlyInsights(
  userId: string,
  params: { year: number; month: number; currency: Currency }
): Promise<AIInsight[]> {
  const { year, month, currency } = params;

  // 1. Gather verified deterministic calculations from application code
  const [dashboardSummary, budgetData, allGoals, memory] = await Promise.all([
    getDashboardSummary(userId, { year, month }),
    getBudgetWithActuals(userId, { year, month, currency }),
    listGoalsWithProgress(userId),
    buildUserFinancialMemory(userId, currency, { year, month }),
  ]);

  const currencyData = dashboardSummary.byCurrency[currency] ?? {
    income: "0.00",
    spending: "0.00",
    saved: "0.00",
    invested: "0.00",
    netCashFlow: "0.00",
    spendingByCategory: [],
  };

  // 2. Format verified mathematical input
  const currencyGoals = allGoals.filter((g) => g.currency === currency);

  const insightInput: MonthlyInsightInput = {
    period: { year, month },
    currency,
    summary: {
      income: currencyData.income,
      spending: currencyData.spending,
      saved: currencyData.saved,
      invested: currencyData.invested,
      netCashFlow: currencyData.netCashFlow,
      topCategories: (currencyData.spendingByCategory ?? []).slice(0, 5).map((c) => ({
        name: c.categoryName,
        amount: c.amount,
      })),
    },
    budget: budgetData
      ? {
          totalAllocated: budgetData.totalAllocated,
          totalActual: budgetData.totalActualSpending,
          overBudgetCategories: budgetData.categories
            .filter((c) => c.isOverBudget)
            .map((c) => ({
              name: c.categoryName,
              allocated: c.allocated,
              actual: c.actual,
            })),
        }
      : null,
    goals: currencyGoals.map((g) => ({
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      percentComplete: g.percentComplete,
      status: g.status,
    })),
    memory,
  };

  // 3. Generate structured observations via Gemini (or deterministic fallback)
  const generatedItems = await generateInsightsWithMemory(insightInput);

  // 4. Atomic upsert: replace any existing non-dismissed insights for this period & currency
  await prisma.$transaction([
    prisma.aIInsight.deleteMany({
      where: {
        userId,
        year,
        month,
        currency,
      },
    }),
    prisma.aIInsight.createMany({
      data: generatedItems.map((item) => ({
        userId,
        year,
        month,
        currency,
        type: item.type,
        title: item.title,
        summary: item.summary,
        actionableStep: item.actionableStep ?? null,
        reasoning: item.reasoning as any,
      })),
    }),
  ]);

  // 5. Return fresh records
  return listStoredMonthlyInsights(userId, { year, month, currency });
}

/**
 * Marks an individual insight as dismissed so it no longer clutters the UI.
 */
export async function dismissInsight(userId: string, insightId: string): Promise<boolean> {
  const result = await prisma.aIInsight.updateMany({
    where: {
      id: insightId,
      userId,
    },
    data: {
      isDismissed: true,
    },
  });

  return result.count > 0;
}
