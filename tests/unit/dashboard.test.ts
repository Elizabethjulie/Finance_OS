import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAccountFindMany, mockTransactionFindMany } = vi.hoisted(() => ({
  mockAccountFindMany: vi.fn(),
  mockTransactionFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findMany: mockAccountFindMany,
    },
    transaction: {
      findMany: mockTransactionFindMany,
    },
  },
}));

import { getDashboardSummary } from "@/services/dashboard/summary";

describe("getDashboardSummary service", () => {
  beforeEach(() => {
    mockAccountFindMany.mockReset();
    mockTransactionFindMany.mockReset();
  });

  it("handles an empty user with no accounts and no transactions", async () => {
    mockAccountFindMany.mockResolvedValueOnce([]);
    mockTransactionFindMany.mockResolvedValueOnce([]);

    const summary = await getDashboardSummary("user_empty", { year: 2026, month: 10 });

    expect(summary.accounts).toEqual([]);
    expect(summary.byCurrency).toEqual({});
    expect(summary.recentTransactions).toEqual([]);
    expect(summary.emergencyFundProgress).toBeNull();
    expect(summary.budgetVsActual).toBeNull();
    expect(summary.upcomingObligations).toEqual([]);
  });

  it("computes single-currency summary with refunds, savings transfers, and month boundaries", async () => {
    mockAccountFindMany.mockResolvedValueOnce([
      {
        id: "acc_checking",
        userId: "user_1",
        name: "KCB Checking",
        type: "BANK",
        currency: "KES",
        openingBalance: "10000.00",
        isArchived: false,
      },
      {
        id: "acc_mmf",
        userId: "user_1",
        name: "CIC MMF",
        type: "MMF",
        currency: "KES",
        openingBalance: "5000.00",
        isArchived: false,
      },
    ]);

    mockTransactionFindMany.mockResolvedValueOnce([
      {
        id: "tx_income",
        userId: "user_1",
        accountId: "acc_checking",
        transferAccountId: null,
        categoryId: null,
        category: null,
        type: "INCOME",
        amount: "50000.00",
        currency: "KES",
        description: "Salary",
        date: new Date("2026-10-05T09:00:00Z"),
        deletedAt: null,
      },
      {
        id: "tx_expense",
        userId: "user_1",
        accountId: "acc_checking",
        transferAccountId: null,
        categoryId: "cat_food",
        category: { id: "cat_food", name: "Food" },
        type: "EXPENSE",
        amount: "4000.00",
        currency: "KES",
        description: "Supermarket",
        date: new Date("2026-10-06T12:00:00Z"),
        deletedAt: null,
      },
      {
        id: "tx_refund",
        userId: "user_1",
        accountId: "acc_checking",
        transferAccountId: null,
        categoryId: "cat_food",
        category: { id: "cat_food", name: "Food" },
        type: "REFUND",
        amount: "500.00",
        currency: "KES",
        description: "Supermarket refund",
        date: new Date("2026-10-07T12:00:00Z"),
        deletedAt: null,
      },
      {
        id: "tx_save_transfer",
        userId: "user_1",
        accountId: "acc_checking",
        transferAccountId: "acc_mmf",
        categoryId: null,
        category: null,
        type: "TRANSFER",
        amount: "12000.00",
        currency: "KES",
        description: "Save to MMF",
        date: new Date("2026-10-10T10:00:00Z"),
        deletedAt: null,
      },
      // September transaction (before 2026-09-30T21:00:00Z EAT October start): affects balance, NOT Oct cashflow
      {
        id: "tx_sep",
        userId: "user_1",
        accountId: "acc_checking",
        transferAccountId: null,
        categoryId: "cat_food",
        category: { id: "cat_food", name: "Food" },
        type: "EXPENSE",
        amount: "1000.00",
        currency: "KES",
        description: "Sept Dinner",
        date: new Date("2026-09-30T20:00:00Z"),
        deletedAt: null,
      },
    ]);

    const summary = await getDashboardSummary("user_1", { year: 2026, month: 10 });

    // Balances include all history:
    // Checking: 10000 + 50000 - 4000 + 500 - 12000 - 1000 = 43500.00
    // MMF: 5000 + 12000 = 17000.00
    // Total KES balance: 60500.00
    expect(summary.byCurrency.KES).toEqual({
      currency: "KES",
      currentBalance: "60500.00",
      income: "50000.00",
      spending: "3500.00", // 4000 - 500 refund (Sept 1000 excluded from Oct cashflow)
      saved: "12000.00", // transfer into MMF account
      invested: "0.00",
      netCashFlow: "46500.00", // 50000 - 3500
      spendingByCategory: [
        {
          categoryId: "cat_food",
          categoryName: "Food",
          amount: "3500.00",
        },
      ],
    });
  });

  it("isolates multiple currencies (KES and USD) in getDashboardSummary", async () => {
    mockAccountFindMany.mockResolvedValueOnce([
      {
        id: "acc_kes",
        userId: "user_1",
        name: "M-Pesa",
        type: "MOBILE_MONEY",
        currency: "KES",
        openingBalance: "2000.00",
        isArchived: false,
      },
      {
        id: "acc_usd",
        userId: "user_1",
        name: "Wise USD",
        type: "BANK",
        currency: "USD",
        openingBalance: "300.00",
        isArchived: false,
      },
    ]);
    mockTransactionFindMany.mockResolvedValueOnce([]);

    const summary = await getDashboardSummary("user_1", { year: 2026, month: 10 });

    expect(summary.byCurrency.KES.currentBalance).toBe("2000.00");
    expect(summary.byCurrency.USD.currentBalance).toBe("300.00");
  });
});

