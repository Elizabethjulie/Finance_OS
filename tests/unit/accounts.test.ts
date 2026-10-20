import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccountSchema } from "@/lib/validation/accounts";

const { mockAccountCreate, mockAccountFindMany, mockTransactionFindMany } = vi.hoisted(
  () => ({
    mockAccountCreate: vi.fn(),
    mockAccountFindMany: vi.fn(),
    mockTransactionFindMany: vi.fn(),
  })
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      create: mockAccountCreate,
      findMany: mockAccountFindMany,
    },
    transaction: {
      findMany: mockTransactionFindMany,
    },
  },
}));

import { createAccount } from "@/services/account/account";
import { listAccountsWithBalances } from "@/services/account/balances";

describe("createAccountSchema — openingBalance validation", () => {
  const baseInput = {
    name: "KCB Checking",
    type: "BANK" as const,
    currency: "KES" as const,
  };

  it("accepts a valid positive openingBalance with up to 2 decimal places", () => {
    const parsedInt = createAccountSchema.parse({
      ...baseInput,
      openingBalance: "15000",
    });
    expect(parsedInt.openingBalance).toBe("15000");

    const parsedDec = createAccountSchema.parse({
      ...baseInput,
      openingBalance: "15000.75",
    });
    expect(parsedDec.openingBalance).toBe("15000.75");
  });

  it("accepts zero ('0' and '0.00')", () => {
    expect(
      createAccountSchema.parse({ ...baseInput, openingBalance: "0" }).openingBalance
    ).toBe("0");
    expect(
      createAccountSchema.parse({ ...baseInput, openingBalance: "0.00" }).openingBalance
    ).toBe("0.00");
  });

  it("defaults empty string, whitespace, or omitted openingBalance to '0'", () => {
    expect(createAccountSchema.parse(baseInput).openingBalance).toBe("0");
    expect(
      createAccountSchema.parse({ ...baseInput, openingBalance: "" }).openingBalance
    ).toBe("0");
    expect(
      createAccountSchema.parse({ ...baseInput, openingBalance: "   " }).openingBalance
    ).toBe("0");
  });

  it("rejects negative openingBalance", () => {
    expect(
      createAccountSchema.safeParse({ ...baseInput, openingBalance: "-1" }).success
    ).toBe(false);
    expect(
      createAccountSchema.safeParse({ ...baseInput, openingBalance: "-0.01" }).success
    ).toBe(false);
  });

  it("rejects openingBalance with more than 2 decimal places", () => {
    const result = createAccountSchema.safeParse({
      ...baseInput,
      openingBalance: "100.123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric openingBalance", () => {
    expect(
      createAccountSchema.safeParse({ ...baseInput, openingBalance: "abc" }).success
    ).toBe(false);
    expect(
      createAccountSchema.safeParse({ ...baseInput, openingBalance: "12.34.56" }).success
    ).toBe(false);
    expect(
      createAccountSchema.safeParse({ ...baseInput, openingBalance: "1,000.00" }).success
    ).toBe(false);
  });
});

describe("createAccount service", () => {
  beforeEach(() => {
    mockAccountCreate.mockReset();
    mockAccountFindMany.mockReset();
    mockTransactionFindMany.mockReset();
  });

  it("persists openingBalance when provided", async () => {
    mockAccountCreate.mockResolvedValueOnce({
      id: "acc_1",
      userId: "user_1",
      name: "M-Pesa",
      type: "MOBILE_MONEY",
      currency: "KES",
      openingBalance: "2500.50",
      isArchived: false,
    });

    await createAccount("user_1", {
      name: "M-Pesa",
      type: "MOBILE_MONEY",
      currency: "KES",
      openingBalance: "2500.50",
    });

    expect(mockAccountCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        name: "M-Pesa",
        type: "MOBILE_MONEY",
        currency: "KES",
        openingBalance: "2500.50",
      },
    });
  });

  it("persists openingBalance as '0' when omitted", async () => {
    mockAccountCreate.mockResolvedValueOnce({
      id: "acc_2",
      userId: "user_1",
      name: "Empty Savings",
      type: "SAVINGS",
      currency: "KES",
      openingBalance: "0",
      isArchived: false,
    });

    await createAccount("user_1", {
      name: "Empty Savings",
      type: "SAVINGS",
      currency: "KES",
    });

    expect(mockAccountCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        name: "Empty Savings",
        type: "SAVINGS",
        currency: "KES",
        openingBalance: "0",
      },
    });
  });
});

describe("listAccountsWithBalances service", () => {
  beforeEach(() => {
    mockAccountFindMany.mockReset();
    mockTransactionFindMany.mockReset();
  });

  it("computes balances including incoming transfers, excludes archived accounts and deleted rows, and groups totals by currency", async () => {
    mockAccountFindMany.mockResolvedValueOnce([
      {
        id: "acc_kcb",
        userId: "user_1",
        name: "KCB Checking",
        type: "BANK",
        currency: "KES",
        openingBalance: "10000.00",
        isArchived: false,
      },
      {
        id: "acc_mpesa",
        userId: "user_1",
        name: "M-Pesa",
        type: "MOBILE_MONEY",
        currency: "KES",
        openingBalance: "1000.00",
        isArchived: false,
      },
      {
        id: "acc_wise",
        userId: "user_1",
        name: "Wise USD",
        type: "BANK",
        currency: "USD",
        openingBalance: "500.00",
        isArchived: false,
      },
    ]);

    mockTransactionFindMany.mockResolvedValueOnce([
      {
        type: "TRANSFER",
        amount: "2500.00",
        currency: "KES",
        accountId: "acc_kcb",
        transferAccountId: "acc_mpesa",
        deletedAt: null,
      },
      {
        type: "EXPENSE",
        amount: "50.00",
        currency: "USD",
        accountId: "acc_wise",
        transferAccountId: null,
        deletedAt: null,
      },
    ]);

    const result = await listAccountsWithBalances("user_1");

    expect(mockAccountFindMany).toHaveBeenCalledWith({
      where: { userId: "user_1", isArchived: false },
      orderBy: { createdAt: "asc" },
    });
    expect(mockTransactionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", deletedAt: null },
      })
    );

    expect(result.accounts).toEqual([
      {
        id: "acc_kcb",
        name: "KCB Checking",
        type: "BANK",
        currency: "KES",
        balance: "7500.00",
      },
      {
        id: "acc_mpesa",
        name: "M-Pesa",
        type: "MOBILE_MONEY",
        currency: "KES",
        balance: "3500.00",
      },
      {
        id: "acc_wise",
        name: "Wise USD",
        type: "BANK",
        currency: "USD",
        balance: "450.00",
      },
    ]);

    expect(result.totalsByCurrency).toEqual({
      KES: "11000.00",
      USD: "450.00",
    });
  });
});
