import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { Currency } from "@/lib/generated/prisma/client";
import { computeBalancesForAccounts, type TxRow } from "@/lib/finance/balance";
import { computeCashflow, type CashflowTxRow } from "@/lib/finance/cashflow";
import { getMonthRange } from "@/lib/finance/dates";
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
  emergencyFundProgress: null;
  budgetVsActual: null;
  upcomingObligations: never[];
};

/**
 * Computes the complete Phase 3 dashboard summary for a given (year, month)
 * using the deterministic Step E calculation helpers.
 */
export async function getDashboardSummary(
  userId: string,
  params: { year: number; month: number; topCategoriesLimit?: number }
): Promise<DashboardSummaryResult> {
  const { year, month, topCategoriesLimit = 5 } = params;
  const range = getMonthRange(year, month, "Africa/Nairobi");

  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      include: { category: true },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
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
    emergencyFundProgress: null,
    budgetVsActual: null,
    upcomingObligations: [],
  };
}

