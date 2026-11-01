import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatAmount, formatMoneyWithCurrency, getCurrencySymbol, sum, toDecimal } from "@/lib/finance/money";
import {
  computeAccountBalance,
  computeBalancesForAccounts,
  CurrencyMismatchError,
  type TxRow,
} from "@/lib/finance/balance";
import { getMonthRange } from "@/lib/finance/dates";
import {
  computeCashflow,
  computeCashflowForCurrency,
  type CashflowTxRow,
} from "@/lib/finance/cashflow";

describe("lib/finance/money", () => {
  it("computes 0.1 + 0.2 as exactly 0.30 and handles large 14,2 values", () => {
    expect(formatAmount(sum(["0.1", "0.2"]))).toBe("0.30");
    expect(formatAmount(sum(["99999999999.99", "0.01"]))).toBe("100000000000.00");
  });

  it("rejects NaN, Infinity, and invalid strings in toDecimal", () => {
    expect(() => toDecimal(Number.NaN)).toThrow();
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => toDecimal("")).toThrow();
    expect(() => toDecimal("not-a-number")).toThrow();
  });

  it("formats money with appropriate currency symbols", () => {
    expect(getCurrencySymbol("KES")).toBe("KSh ");
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("USD")).toBe("$");
    expect(getCurrencySymbol("GBP")).toBe("£");

    expect(formatMoneyWithCurrency("25000", "KES")).toBe("KSh 25,000.00");
    expect(formatMoneyWithCurrency(1000, "EUR")).toBe("€1,000.00");
    expect(formatMoneyWithCurrency("-50.5", "USD")).toBe("-$50.50");
  });
});

describe("lib/finance/balance", () => {
  const accountA = {
    id: "acc_a",
    currency: "KES" as const,
    openingBalance: "1000.00",
  };
  const accountB = {
    id: "acc_b",
    currency: "KES" as const,
    openingBalance: "500.00",
  };

  it("returns opening balance when there are no transactions", () => {
    expect(computeAccountBalance(accountA, [])).toBe("1000.00");
  });

  it("moves balance in the right direction for INCOME, EXPENSE, REFUND, WITHDRAWAL, INVESTMENT_CONTRIBUTION", () => {
    const base = {
      currency: "KES" as const,
      accountId: "acc_a",
      transferAccountId: null,
      deletedAt: null,
    };

    expect(
      computeAccountBalance(accountA, [{ ...base, type: "INCOME", amount: "250.50" }])
    ).toBe("1250.50");

    expect(
      computeAccountBalance(accountA, [{ ...base, type: "REFUND", amount: "75.25" }])
    ).toBe("1075.25");

    expect(
      computeAccountBalance(accountA, [{ ...base, type: "EXPENSE", amount: "300.00" }])
    ).toBe("700.00");

    expect(
      computeAccountBalance(accountA, [{ ...base, type: "WITHDRAWAL", amount: "150.00" }])
    ).toBe("850.00");

    expect(
      computeAccountBalance(accountA, [
        { ...base, type: "INVESTMENT_CONTRIBUTION", amount: "400.00" },
      ])
    ).toBe("600.00");
  });

  it("handles TRANSFER between two accounts: source decreases, destination increases, combined total stays constant", () => {
    const transferRow: TxRow = {
      type: "TRANSFER",
      amount: "350.25",
      currency: "KES",
      accountId: "acc_a",
      transferAccountId: "acc_b",
      deletedAt: null,
    };

    const balancesBefore = computeBalancesForAccounts([accountA, accountB], []);
    const totalBefore = sum([balancesBefore.acc_a, balancesBefore.acc_b]);

    const balancesAfter = computeBalancesForAccounts([accountA, accountB], [transferRow]);
    const totalAfter = sum([balancesAfter.acc_a, balancesAfter.acc_b]);

    expect(balancesAfter.acc_a).toBe("649.75");
    expect(balancesAfter.acc_b).toBe("850.25");
    expect(formatAmount(totalAfter)).toBe(formatAmount(totalBefore));
    expect(formatAmount(totalAfter)).toBe("1500.00");
  });

  it("ignores soft-deleted transactions (including a deleted transfer) and unrelated accounts", () => {
    const rows: TxRow[] = [
      {
        type: "EXPENSE",
        amount: "999.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: new Date("2026-10-15T10:00:00Z"),
      },
      {
        type: "TRANSFER",
        amount: "400.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: "acc_b",
        deletedAt: new Date("2026-10-16T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "500.00",
        currency: "KES",
        accountId: "acc_unrelated",
        transferAccountId: null,
        deletedAt: null,
      },
    ];

    const balances = computeBalancesForAccounts([accountA, accountB], rows);
    expect(balances.acc_a).toBe("1000.00");
    expect(balances.acc_b).toBe("500.00");
  });

  it("preserves negative balances (overdraft) without clamping", () => {
    const row: TxRow = {
      type: "EXPENSE",
      amount: "1250.75",
      currency: "KES",
      accountId: "acc_a",
      transferAccountId: null,
      deletedAt: null,
    };
    expect(computeAccountBalance(accountA, [row])).toBe("-250.75");
  });

  it("throws CurrencyMismatchError when a related transaction has a different currency", () => {
    const badRow: TxRow = {
      type: "EXPENSE",
      amount: "50.00",
      currency: "USD",
      accountId: "acc_a",
      transferAccountId: null,
      deletedAt: null,
    };

    expect(() => computeAccountBalance(accountA, [badRow])).toThrow(CurrencyMismatchError);
  });
});

describe("lib/finance/dates and lib/finance/cashflow", () => {
  const octRange = getMonthRange(2026, 10, "Africa/Nairobi");
  const sepRange = getMonthRange(2026, 9, "Africa/Nairobi");

  it("computes Africa/Nairobi month boundaries in UTC accurately", () => {
    // 1 Oct 2026 00:00:00 EAT (UTC+3) is 2026-09-30T21:00:00.000Z
    expect(octRange.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(octRange.end.toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(sepRange.end.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("places a transaction at 2026-09-30T21:30:00Z (00:30 on 1 Oct in Nairobi) into October, not September", () => {
    const boundaryTx: CashflowTxRow = {
      type: "EXPENSE",
      amount: "1200.00",
      currency: "KES",
      accountId: "acc_a",
      transferAccountId: null,
      deletedAt: null,
      date: new Date("2026-09-30T21:30:00Z"),
    };

    const sepCashflow = computeCashflowForCurrency([boundaryTx], sepRange, "KES");
    const octCashflow = computeCashflowForCurrency([boundaryTx], octRange, "KES");

    expect(sepCashflow.spending).toBe("0.00");
    expect(octCashflow.spending).toBe("1200.00");
  });

  it("offsets spending with REFUND (never counting refund as income) and excludes TRANSFER and WITHDRAWAL", () => {
    const rows: CashflowTxRow[] = [
      {
        type: "INCOME",
        amount: "5000.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-05T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "1500.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-06T10:00:00Z"),
      },
      {
        type: "REFUND",
        amount: "300.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-07T10:00:00Z"),
      },
      {
        type: "INVESTMENT_CONTRIBUTION",
        amount: "800.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-08T10:00:00Z"),
      },
      {
        type: "TRANSFER",
        amount: "2000.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: "acc_b",
        deletedAt: null,
        date: new Date("2026-10-09T10:00:00Z"),
      },
      {
        type: "WITHDRAWAL",
        amount: "400.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-10T10:00:00Z"),
      },
    ];

    const kes = computeCashflowForCurrency(rows, octRange, "KES");
    expect(kes).toEqual({
      currency: "KES",
      income: "5000.00",
      spending: "1200.00", // 1500 - 300 refund
      invested: "800.00",
      netCashFlow: "3000.00", // 5000 - 1200 - 800
    });
  });

  it("handles zero income, zero transactions, and negative net cash flow without NaN", () => {
    expect(computeCashflow([], octRange)).toEqual([]);
    const emptyKes = computeCashflowForCurrency([], octRange, "KES");
    expect(emptyKes).toEqual({
      currency: "KES",
      income: "0.00",
      spending: "0.00",
      invested: "0.00",
      netCashFlow: "0.00",
    });

    const expenseOnly: CashflowTxRow[] = [
      {
        type: "EXPENSE",
        amount: "450.50",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-12T10:00:00Z"),
      },
    ];
    const neg = computeCashflowForCurrency(expenseOnly, octRange, "KES");
    expect(neg.income).toBe("0.00");
    expect(neg.spending).toBe("450.50");
    expect(neg.netCashFlow).toBe("-450.50");
  });

  it("groups multiple currencies separately and never sums KES with EUR or USD", () => {
    const rows: CashflowTxRow[] = [
      {
        type: "INCOME",
        amount: "100000.00",
        currency: "KES",
        accountId: "acc_kes",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-03T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "25000.00",
        currency: "KES",
        accountId: "acc_kes",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-04T10:00:00Z"),
      },
      {
        type: "INCOME",
        amount: "1200.00",
        currency: "EUR",
        accountId: "acc_eur",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-05T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "200.00",
        currency: "EUR",
        accountId: "acc_eur",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-06T10:00:00Z"),
      },
    ];

    const result = computeCashflow(rows, octRange);
    expect(result).toEqual([
      {
        currency: "KES",
        income: "100000.00",
        spending: "25000.00",
        invested: "0.00",
        netCashFlow: "75000.00",
      },
      {
        currency: "EUR",
        income: "1200.00",
        spending: "200.00",
        invested: "0.00",
        netCashFlow: "1000.00",
      },
    ]);
  });

  it("ignores soft-deleted transactions in cashflow totals", () => {
    const rows: CashflowTxRow[] = [
      {
        type: "INCOME",
        amount: "1000.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: new Date("2026-10-10T12:00:00Z"),
        date: new Date("2026-10-05T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "300.00",
        currency: "KES",
        accountId: "acc_a",
        transferAccountId: null,
        deletedAt: new Date("2026-10-10T12:00:00Z"),
        date: new Date("2026-10-06T10:00:00Z"),
      },
    ];

    const kes = computeCashflowForCurrency(rows, octRange, "KES");
    expect(kes).toEqual({
      currency: "KES",
      income: "0.00",
      spending: "0.00",
      invested: "0.00",
      netCashFlow: "0.00",
    });
  });

  it(" preserves exact decimal precision across many small transactions", () => {
    const rows: CashflowTxRow[] = [
      {
        type: "EXPENSE",
        amount: "0.10",
        currency: "USD",
        accountId: "acc_usd",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-05T10:00:00Z"),
      },
      {
        type: "EXPENSE",
        amount: "0.20",
        currency: "USD",
        accountId: "acc_usd",
        transferAccountId: null,
        deletedAt: null,
        date: new Date("2026-10-06T10:00:00Z"),
      },
    ];

    const usd = computeCashflowForCurrency(rows, octRange, "USD");
    expect(usd.spending).toBe("0.30");
    expect(usd.netCashFlow).toBe("-0.30");
    expect(new Decimal(usd.spending).equals("0.30")).toBe(true);
  });
});

