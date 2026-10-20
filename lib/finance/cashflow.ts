import Decimal from "decimal.js";
import type { Currency, TxRow } from "./balance";
import { formatAmount, toDecimal } from "./money";

export type CashflowTxRow = TxRow & {
  date: Date;
};

export type CurrencyCashflow = {
  currency: Currency;
  income: string;      // sum of INCOME
  spending: string;    // EXPENSE minus REFUND (refunds offset spending, they are NOT income)
  invested: string;    // sum of INVESTMENT_CONTRIBUTION
  netCashFlow: string; // income - spending - invested
};

type MutableBuckets = {
  income: Decimal;
  expense: Decimal;
  refund: Decimal;
  invested: Decimal;
};

const CURRENCY_ORDER: Currency[] = ["KES", "EUR", "GBP", "USD"];

/**
 * Computes monthly/period cashflow totals grouped by currency for rows within `[start, end)`.
 *
 * Rules:
 * - Only rows with `deletedAt === null` and `date >= range.start && date < range.end` count.
 * - `TRANSFER` rows are excluded entirely (moving money between own accounts is neither income nor spending).
 * - `WITHDRAWAL` rows are excluded from income/spending/invested totals in this version
 *   (a withdrawal changes account balances only, e.g. ATM cash withdrawal, rather than being
 *   categorized spending or investment).
 * - `REFUND` offsets `EXPENSE` (`spending = EXPENSE - REFUND`) and is never counted as `INCOME`.
 * - Totals are strictly grouped per currency; currencies are never summed together.
 */
export function computeCashflow(
  rows: CashflowTxRow[],
  range: { start: Date; end: Date },
  seedCurrencies: Currency[] = []
): CurrencyCashflow[] {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const buckets = new Map<Currency, MutableBuckets>();

  const ensureBucket = (currency: Currency): MutableBuckets => {
    let b = buckets.get(currency);
    if (!b) {
      b = {
        income: new Decimal(0),
        expense: new Decimal(0),
        refund: new Decimal(0),
        invested: new Decimal(0),
      };
      buckets.set(currency, b);
    }
    return b;
  };

  for (const c of seedCurrencies) {
    ensureBucket(c);
  }

  for (const row of rows) {
    if (row.deletedAt !== null) {
      continue;
    }

    const txMs = row.date.getTime();
    if (txMs < startMs || txMs >= endMs) {
      continue;
    }

    // Transfers and withdrawals do not count toward income, spending, or invested cashflow
    if (row.type === "TRANSFER" || row.type === "WITHDRAWAL") {
      continue;
    }

    const amount = toDecimal(row.amount);
    const bucket = ensureBucket(row.currency);

    switch (row.type) {
      case "INCOME":
        bucket.income = bucket.income.plus(amount);
        break;
      case "EXPENSE":
        bucket.expense = bucket.expense.plus(amount);
        break;
      case "REFUND":
        bucket.refund = bucket.refund.plus(amount);
        break;
      case "INVESTMENT_CONTRIBUTION":
        bucket.invested = bucket.invested.plus(amount);
        break;
    }
  }

  const results: CurrencyCashflow[] = [];

  for (const currency of CURRENCY_ORDER) {
    const b = buckets.get(currency);
    if (!b) continue;

    const spending = b.expense.minus(b.refund);
    const netCashFlow = b.income.minus(spending).minus(b.invested);

    results.push({
      currency,
      income: formatAmount(b.income),
      spending: formatAmount(spending),
      invested: formatAmount(b.invested),
      netCashFlow: formatAmount(netCashFlow),
    });
  }

  return results;
}

/**
 * Convenience helper returning a single currency's cashflow for `[start, end)`
 * (returns "0.00" across all fields when there are no matching transactions).
 */
export function computeCashflowForCurrency(
  rows: CashflowTxRow[],
  range: { start: Date; end: Date },
  currency: Currency
): CurrencyCashflow {
  const [entry] = computeCashflow(
    rows.filter((r) => r.currency === currency),
    range,
    [currency]
  );
  return entry;
}

