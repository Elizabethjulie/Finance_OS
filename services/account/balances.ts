import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { AccountType, Currency } from "@/lib/generated/prisma/client";
import { computeBalancesForAccounts, type TxRow } from "@/lib/finance/balance";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export type AccountWithBalance = {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: string;
};

export type AccountsWithBalancesResult = {
  accounts: AccountWithBalance[];
  totalsByCurrency: Record<Currency, string>;
};

/**
 * Loads the user's non-archived accounts and non-deleted transactions (both outgoing
 * and incoming transfers), computes exact balances using pure helpers from Step E,
 * and aggregates totals per currency without mixing currencies.
 */
export async function listAccountsWithBalances(
  userId: string
): Promise<AccountsWithBalancesResult> {
  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      select: {
        type: true,
        amount: true,
        currency: true,
        accountId: true,
        transferAccountId: true,
        deletedAt: true,
      },
    }),
  ]);

  const txRows: TxRow[] = transactions.map((tx) => ({
    type: tx.type,
    amount: String(tx.amount),
    currency: tx.currency,
    accountId: tx.accountId,
    transferAccountId: tx.transferAccountId,
    deletedAt: tx.deletedAt,
  }));

  const balanceMap = computeBalancesForAccounts(
    accounts.map((acc) => ({
      id: acc.id,
      currency: acc.currency,
      openingBalance: String(acc.openingBalance ?? "0"),
    })),
    txRows
  );

  const currencyAccumulators = new Map<Currency, Decimal>();

  const enrichedAccounts: AccountWithBalance[] = accounts.map((acc) => {
    const balance = balanceMap[acc.id] ?? "0.00";
    const currentTotal = currencyAccumulators.get(acc.currency) ?? new Decimal(0);
    currencyAccumulators.set(acc.currency, currentTotal.plus(toDecimal(balance)));

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      balance,
    };
  });

  const totalsByCurrency = {} as Record<Currency, string>;
  currencyAccumulators.forEach((total, currency) => {
    totalsByCurrency[currency] = formatAmount(total);
  });

  return {
    accounts: enrichedAccounts,
    totalsByCurrency,
  };
}

