import Decimal from "decimal.js";
import { formatAmount, toDecimal } from "./money";

export type Currency = "KES" | "EUR" | "GBP" | "USD";

export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "INVESTMENT_CONTRIBUTION"
  | "WITHDRAWAL"
  | "REFUND";

export type TxRow = {
  type: TransactionType;
  amount: string; // positive decimal string
  currency: Currency;
  accountId: string;
  transferAccountId: string | null;
  deletedAt: Date | null;
  date?: Date;
};

export type BalanceAccountInput = {
  id: string;
  currency: Currency;
  openingBalance: string;
};

export class CurrencyMismatchError extends Error {
  constructor(message = "Transaction currency must match the account currency.") {
    super(message);
    this.name = "CurrencyMismatchError";
  }
}

/**
 * Deterministically computes a single account's balance from its openingBalance
 * and transaction rows. Soft-deleted rows and unrelated rows are ignored.
 * Throws CurrencyMismatchError if any row touching the account has a different currency.
 * Negative balances (overdrafts) are preserved without clamping.
 */
export function computeAccountBalance(
  account: BalanceAccountInput,
  rows: TxRow[]
): string {
  let balance: Decimal = toDecimal(account.openingBalance);

  for (const row of rows) {
    if (row.deletedAt !== null) {
      continue;
    }

    const isSource = row.accountId === account.id;
    const isDest = row.transferAccountId === account.id;

    if (!isSource && !isDest) {
      continue;
    }

    if (row.currency !== account.currency) {
      throw new CurrencyMismatchError(
        `Currency mismatch on account ${account.id}: expected ${account.currency}, got ${row.currency}.`
      );
    }

    const amount = toDecimal(row.amount);

    if (row.type === "TRANSFER") {
      if (isSource) {
        balance = balance.minus(amount);
      }
      if (isDest) {
        balance = balance.plus(amount);
      }
      continue;
    }

    if (!isSource) {
      continue;
    }

    switch (row.type) {
      case "INCOME":
      case "REFUND":
        balance = balance.plus(amount);
        break;
      case "EXPENSE":
      case "WITHDRAWAL":
      case "INVESTMENT_CONTRIBUTION":
        balance = balance.minus(amount);
        break;
    }
  }

  return formatAmount(balance);
}

/**
 * Computes balances for multiple accounts, returning a map of accountId -> formatted balance string.
 */
export function computeBalancesForAccounts(
  accounts: BalanceAccountInput[],
  rows: TxRow[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const account of accounts) {
    result[account.id] = computeAccountBalance(account, rows);
  }
  return result;
}

