import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { Currency } from "@/lib/generated/prisma/client";
import {
  computeBudgetVsActual,
  generateGoalBasedBudget,
  type BudgetVsActualSummary,
  type HistoricalCategorySpendRow,
} from "@/lib/finance/budget";
import { getMonthRange } from "@/lib/finance/dates";
import { formatAmount, toDecimal } from "@/lib/finance/money";
import {
  generateBudgetSchema,
  updateBudgetAllocationsSchema,
  type GenerateBudgetInput,
  type UpdateBudgetAllocationsInput,
} from "@/lib/validation/budgets";
import { CategoryNotFoundError, listCategories } from "@/services/category/category";
import { listGoalsWithProgress } from "@/services/goal/goal";

export class BudgetNotFoundError extends Error {
  constructor() {
    super("Budget not found");
    this.name = "BudgetNotFoundError";
  }
}

function getPreviousMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) - offset;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  return { year: targetYear, month: targetMonth };
}

async function computeActualSpendingByCategory(
  userId: string,
  year: number,
  month: number,
  currency: Currency
): Promise<Record<string, string>> {
  const range = getMonthRange(year, month, "Africa/Nairobi");
  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      currency,
      deletedAt: null,
      date: {
        gte: range.start,
        lt: range.end,
      },
      type: {
        in: ["EXPENSE", "REFUND"],
      },
    },
    select: {
      categoryId: true,
      type: true,
      amount: true,
    },
  });

  const totals = new Map<string, Decimal>();
  for (const tx of txs) {
    if (!tx.categoryId) continue;
    const current = totals.get(tx.categoryId) ?? new Decimal(0);
    const amt = toDecimal(String(tx.amount));
    const next = tx.type === "EXPENSE" ? current.plus(amt) : current.minus(amt);
    totals.set(tx.categoryId, next);
  }

  const out: Record<string, string> = {};
  totals.forEach((val, catId) => {
    out[catId] = formatAmount(Decimal.max(new Decimal(0), val));
  });
  return out;
}

export async function getBudgetWithActuals(
  userId: string,
  params: { year: number; month: number; currency: Currency }
): Promise<BudgetVsActualSummary | null> {
  const { year, month, currency } = params;

  const budget = await prisma.budget.findUnique({
    where: {
      userId_year_month_currency: {
        userId,
        year,
        month,
        currency,
      },
    },
    include: {
      categories: {
        include: {
          category: true,
        },
        orderBy: {
          allocated: "desc",
        },
      },
    },
  });

  if (!budget) {
    return null;
  }

  const actualByCategoryId = await computeActualSpendingByCategory(
    userId,
    year,
    month,
    currency
  );

  return computeBudgetVsActual(
    {
      id: budget.id,
      year: budget.year,
      month: budget.month,
      currency: budget.currency,
      expectedIncome: String(budget.expectedIncome),
      totalAllocated: String(budget.totalAllocated),
      savingsTarget: String(budget.savingsTarget),
      rationale: budget.rationale,
      categories: budget.categories.map((bc) => ({
        categoryId: bc.categoryId,
        categoryName: bc.category.name,
        allocated: String(bc.allocated),
        isEssential: bc.isEssential,
      })),
    },
    actualByCategoryId
  );
}

export async function generateAndSaveBudget(
  userId: string,
  rawInput: GenerateBudgetInput
): Promise<BudgetVsActualSummary> {
  const { year, month, currency } = generateBudgetSchema.parse(rawInput);

  // Compute 3-month lookback window for historical spending
  const oldestMonth = getPreviousMonth(year, month, 3);
  const historyStart = getMonthRange(oldestMonth.year, oldestMonth.month, "Africa/Nairobi").start;
  const currentMonthStart = getMonthRange(year, month, "Africa/Nairobi").start;

  const [incomeSources, categories, historicalTxs, allGoals] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { userId, isActive: true, currency },
    }),
    listCategories(userId),
    prisma.transaction.findMany({
      where: {
        userId,
        currency,
        deletedAt: null,
        date: {
          gte: historyStart,
          lt: currentMonthStart,
        },
        type: {
          in: ["EXPENSE", "REFUND"],
        },
      },
      include: {
        category: true,
      },
    }),
    listGoalsWithProgress(userId, currentMonthStart),
  ]);

  // Group historical net spending by category across up to 3 past months
  const histSpendByCat = new Map<string, { name: string; total: Decimal }>();
  for (const tx of historicalTxs) {
    if (!tx.categoryId || !tx.category) continue;
    const entry = histSpendByCat.get(tx.categoryId) ?? {
      name: tx.category.name,
      total: new Decimal(0),
    };
    const amt = toDecimal(String(tx.amount));
    entry.total = tx.type === "EXPENSE" ? entry.total.plus(amt) : entry.total.minus(amt);
    histSpendByCat.set(tx.categoryId, entry);
  }

  const historicalSpending: HistoricalCategorySpendRow[] = [];
  histSpendByCat.forEach((val, categoryId) => {
    if (val.total.gt(0)) {
      historicalSpending.push({
        categoryId,
        categoryName: val.name,
        // Average over the 3-month lookback window
        averageMonthlySpend: formatAmount(val.total.div(3)),
      });
    }
  });

  const goalsForCurrency = allGoals
    .filter((g) => g.currency === currency && g.status !== "COMPLETED")
    .map((g) => ({
      goalId: g.goalId,
      name: g.name,
      type: g.type,
      requiredMonthlyContribution: g.requiredMonthlyContribution,
    }));

  const plan = generateGoalBasedBudget({
    currency,
    incomeSources: incomeSources.map((src) => ({
      amount: String(src.amount),
      currency: src.currency,
      frequency: src.frequency,
      isActive: src.isActive,
    })),
    historicalSpending,
    goals: goalsForCurrency,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.budget.findUnique({
      where: {
        userId_year_month_currency: {
          userId,
          year,
          month,
          currency,
        },
      },
    });

    const budgetRecord = existing
      ? await tx.budget.update({
          where: { id: existing.id },
          data: {
            expectedIncome: plan.expectedIncome,
            totalAllocated: plan.totalAllocated,
            savingsTarget: plan.savingsTarget,
            rationale: plan.rationale,
          },
        })
      : await tx.budget.create({
          data: {
            userId,
            year,
            month,
            currency,
            expectedIncome: plan.expectedIncome,
            totalAllocated: plan.totalAllocated,
            savingsTarget: plan.savingsTarget,
            rationale: plan.rationale,
          },
        });

    await tx.budgetCategory.deleteMany({
      where: { budgetId: budgetRecord.id },
    });

    if (plan.categories.length > 0) {
      await tx.budgetCategory.createMany({
        data: plan.categories.map((cat) => ({
          budgetId: budgetRecord.id,
          categoryId: cat.categoryId,
          allocated: cat.allocated,
          isEssential: cat.isEssential,
          note: cat.note,
        })),
      });
    }
  });

  const saved = await getBudgetWithActuals(userId, { year, month, currency });
  if (!saved) {
    throw new BudgetNotFoundError();
  }
  return saved;
}

export async function updateBudgetAllocations(
  userId: string,
  budgetId: string,
  rawInput: UpdateBudgetAllocationsInput
): Promise<BudgetVsActualSummary> {
  const data = updateBudgetAllocationsSchema.parse(rawInput);

  const existing = await prisma.budget.findFirst({
    where: { id: budgetId, userId },
  });
  if (!existing) {
    throw new BudgetNotFoundError();
  }

  const allowedCategories = await listCategories(userId);
  const allowedById = new Map(allowedCategories.map((c) => [c.id, c]));

  let totalAllocated = new Decimal(0);
  let savingsTarget = new Decimal(0);

  for (const item of data.categories) {
    const cat = allowedById.get(item.categoryId);
    if (!cat) {
      throw new CategoryNotFoundError();
    }
    const amt = toDecimal(item.allocated);
    totalAllocated = totalAllocated.plus(amt);
    const lowerName = cat.name.trim().toLowerCase();
    if (lowerName === "savings" || lowerName === "investment") {
      savingsTarget = savingsTarget.plus(amt);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.budget.update({
      where: { id: existing.id },
      data: {
        totalAllocated: formatAmount(totalAllocated),
        savingsTarget: formatAmount(savingsTarget),
      },
    });

    await tx.budgetCategory.deleteMany({
      where: { budgetId: existing.id },
    });

    await tx.budgetCategory.createMany({
      data: data.categories.map((item) => ({
        budgetId: existing.id,
        categoryId: item.categoryId,
        allocated: formatAmount(toDecimal(item.allocated)),
        isEssential: item.isEssential ?? false,
        note: item.note ?? null,
      })),
    });
  });

  const updated = await getBudgetWithActuals(userId, {
    year: existing.year,
    month: existing.month,
    currency: existing.currency,
  });
  if (!updated) {
    throw new BudgetNotFoundError();
  }
  return updated;
}

