import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { Currency } from "@/lib/generated/prisma/client";
import { computeBalancesForAccounts, type TxRow } from "@/lib/finance/balance";
import { computeBudgetVsActual, type BudgetVsActualSummary } from "@/lib/finance/budget";
import { computeCashflow, type CashflowTxRow } from "@/lib/finance/cashflow";
import { getMonthRange } from "@/lib/finance/dates";
import {
  computeGoalProgress,
  type ComputedGoalProgress,
  type GoalContributionRow,
} from "@/lib/finance/goals";
import { formatAmount, toDecimal } from "@/lib/finance/money";
import type { AccountWithBalance } from "@/services/account/balances";

export type CategorySpendingItem = {
  categoryId: string | null;
  categoryName: string;
  amount: string;
};

export type CurrencyDashboardTotals = {
  currency: Currency;
  currentBalance: string;
  income: string;
  spending: string;
  saved: string; // incoming transfers into SAVINGS or MMF accounts during the month
  invested: string;
  netCashFlow: string;
  spendingByCategory: CategorySpendingItem[];
};

export type DashboardSummaryResult = {
  period: {
    year: number;
    month: number;
    start: string;
    end: string;
  };
  byCurrency: Record<Currency, CurrencyDashboardTotals>;
  accounts: AccountWithBalance[];
  recentTransactions: Array<{
    id: string;
    accountId: string;
    transferAccountId: string | null;
    categoryId: string | null;
    categoryName: string | null;
    type: string;
    amount: string;
    currency: Currency;
    description: string;
    date: string;
  }>;
  emergencyFundProgress: Partial<Record<Currency, ComputedGoalProgress>> | null;
  budgetVsActual: Partial<Record<Currency, BudgetVsActualSummary>> | null;
  upcomingObligations: never[];
};

/**
 * Computes the complete Phase 3–5 dashboard summary for a given (year, month)
 * using the deterministic calculation helpers from lib/finance/*.
 */
export async function getDashboardSummary(
  userId: string,
  params: { year: number; month: number; topCategoriesLimit?: number }
): Promise<DashboardSummaryResult> {
  const { year, month, topCategoriesLimit = 5 } = params;
  const range = getMonthRange(year, month, "Africa/Nairobi");

  const [accounts, transactions, emergencyGoals, goalContributions, budgets] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId, isArchived: false },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.findMany({
        where: { userId, deletedAt: null },
        include: { category: true },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
      prisma.goal
        ? prisma.goal.findMany({
            where: { userId, isArchived: false, type: "EMERGENCY_FUND" },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
      prisma.goalContribution
        ? prisma.goalContribution.findMany({
            where: { userId },
            orderBy: { contributedAt: "asc" },
          })
        : Promise.resolve([]),
      prisma.budget
        ? prisma.budget.findMany({
            where: { userId, year, month },
            include: {
              categories: {
                include: { category: true },
                orderBy: { allocated: "desc" },
              },
            },
          })
        : Promise.resolve([]),
    ]);

  const txRows: CashflowTxRow[] = transactions.map((tx) => ({
    type: tx.type,
    amount: String(tx.amount),
    currency: tx.currency,
    accountId: tx.accountId,
    transferAccountId: tx.transferAccountId,
    deletedAt: tx.deletedAt,
    date: tx.date,
  }));

  const balanceMap = computeBalancesForAccounts(
    accounts.map((a) => ({
      id: a.id,
      currency: a.currency,
      openingBalance: String(a.openingBalance ?? "0"),
    })),
    txRows as TxRow[]
  );

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const activeCurrencies = new Set<Currency>();
  for (const acc of accounts) {
    activeCurrencies.add(acc.currency);
  }
  for (const tx of transactions) {
    activeCurrencies.add(tx.currency);
  }

  const enrichedAccounts: AccountWithBalance[] = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    currency: acc.currency,
    balance: balanceMap[acc.id] ?? "0.00",
  }));

  const cashflowList = computeCashflow(
    txRows,
    range,
    Array.from(activeCurrencies)
  );
  const cashflowByCurrency = new Map(cashflowList.map((c) => [c.currency, c]));

  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const byCurrency = {} as Record<Currency, CurrencyDashboardTotals>;
  const actualSpendingByCurrencyAndCat = new Map<Currency, Record<string, string>>();

  for (const currency of Array.from(activeCurrencies)) {
    let totalBalance = new Decimal(0);
    for (const acc of enrichedAccounts) {
      if (acc.currency === currency) {
        totalBalance = totalBalance.plus(toDecimal(acc.balance));
      }
    }

    // "Amount saved this month": incoming transfers into SAVINGS or MMF accounts
    let savedThisMonth = new Decimal(0);
    const catSpendingMap = new Map<string | null, { name: string; total: Decimal }>();

    for (const tx of transactions) {
      if (tx.deletedAt !== null || tx.currency !== currency) continue;
      const txMs = tx.date.getTime();
      if (txMs < startMs || txMs >= endMs) continue;

      const amt = toDecimal(String(tx.amount));

      if (tx.type === "TRANSFER" && tx.transferAccountId) {
        const destAcc = accountById.get(tx.transferAccountId);
        if (destAcc && (destAcc.type === "SAVINGS" || destAcc.type === "MMF")) {
          savedThisMonth = savedThisMonth.plus(amt);
        }
      }

      if (tx.type === "EXPENSE" || tx.type === "REFUND") {
        const key = tx.categoryId ?? null;
        const name = tx.category?.name ?? "Uncategorized";
        const current = catSpendingMap.get(key) ?? {
          name,
          total: new Decimal(0),
        };
        current.total =
          tx.type === "EXPENSE" ? current.total.plus(amt) : current.total.minus(amt);
        catSpendingMap.set(key, current);
      }
    }

    const catRecordForBudget: Record<string, string> = {};
    catSpendingMap.forEach((v, k) => {
      if (k !== null && v.total.gt(0)) {
        catRecordForBudget[k] = formatAmount(v.total);
      }
    });
    actualSpendingByCurrencyAndCat.set(currency, catRecordForBudget);

    const spendingByCategory: CategorySpendingItem[] = Array.from(
      catSpendingMap.entries()
    )
      .filter(([, v]) => v.total.gt(0))
      .sort((a, b) => b[1].total.cmp(a[1].total))
      .slice(0, topCategoriesLimit)
      .map(([categoryId, v]) => ({
        categoryId,
        categoryName: v.name,
        amount: formatAmount(v.total),
      }));

    const cf = cashflowByCurrency.get(currency);

    byCurrency[currency] = {
      currency,
      currentBalance: formatAmount(totalBalance),
      income: cf?.income ?? "0.00",
      spending: cf?.spending ?? "0.00",
      saved: formatAmount(savedThisMonth),
      invested: cf?.invested ?? "0.00",
      netCashFlow: cf?.netCashFlow ?? "0.00",
      spendingByCategory,
    };
  }

  // Phase 5: Emergency fund progress per currency
  let emergencyFundProgress: Partial<Record<Currency, ComputedGoalProgress>> | null = null;
  if (emergencyGoals.length > 0) {
    emergencyFundProgress = {};
    const contribRows: GoalContributionRow[] = goalContributions.map((c) => ({
      goalId: c.goalId,
      amount: String(c.amount),
      currency: c.currency,
      contributedAt: c.contributedAt,
    }));

    for (const g of emergencyGoals) {
      if (!emergencyFundProgress[g.currency]) {
        emergencyFundProgress[g.currency] = computeGoalProgress(
          {
            id: g.id,
            name: g.name,
            type: g.type,
            targetAmount: String(g.targetAmount),
            startingAmount: String(g.startingAmount ?? "0"),
            currency: g.currency,
            targetDate: g.targetDate,
            createdAt: g.createdAt,
          },
          contribRows,
          range.end
        );
      }
    }
  }

  // Phase 4: Budget vs actual per currency
  let budgetVsActual: Partial<Record<Currency, BudgetVsActualSummary>> | null = null;
  if (budgets.length > 0) {
    budgetVsActual = {};
    for (const b of budgets) {
      const actuals = actualSpendingByCurrencyAndCat.get(b.currency) ?? {};
      budgetVsActual[b.currency] = computeBudgetVsActual(
        {
          id: b.id,
          year: b.year,
          month: b.month,
          currency: b.currency,
          expectedIncome: String(b.expectedIncome),
          totalAllocated: String(b.totalAllocated),
          savingsTarget: String(b.savingsTarget),
          rationale: b.rationale,
          categories: b.categories.map((bc) => ({
            categoryId: bc.categoryId,
            categoryName: bc.category.name,
            allocated: String(bc.allocated),
            isEssential: bc.isEssential,
          })),
        },
        actuals
      );
    }
  }

  const recentTransactions = transactions.slice(0, 5).map((tx) => ({
    id: tx.id,
    accountId: tx.accountId,
    transferAccountId: tx.transferAccountId,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    type: tx.type,
    amount: formatAmount(toDecimal(String(tx.amount))),
    currency: tx.currency,
    description: tx.description,
    date: tx.date.toISOString(),
  }));

  return {
    period: {
      year,
      month,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    byCurrency,
    accounts: enrichedAccounts,
    recentTransactions,
    emergencyFundProgress,
    budgetVsActual,
    upcomingObligations: [],
  };
}

