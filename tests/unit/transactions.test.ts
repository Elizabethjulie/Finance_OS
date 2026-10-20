import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransactionSchema } from "@/lib/validation/transactions";
import { AccountNotFoundError } from "@/services/account/account";

const {
  mockAccountFindUnique,
  mockCategoryFindUnique,
  mockTransactionCreate,
  mockTransactionFindUnique,
  mockTransactionFindMany,
  mockTransactionUpdate,
} = vi.hoisted(() => ({
  mockAccountFindUnique: vi.fn(),
  mockCategoryFindUnique: vi.fn(),
  mockTransactionCreate: vi.fn(),
  mockTransactionFindUnique: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockTransactionUpdate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findUnique: mockAccountFindUnique,
    },
    category: {
      findUnique: mockCategoryFindUnique,
    },
    transaction: {
      create: mockTransactionCreate,
      findUnique: mockTransactionFindUnique,
      findMany: mockTransactionFindMany,
      update: mockTransactionUpdate,
    },
  },
}));

import {
  listTransactions,
  createTransaction,
  updateTransaction,
  softDeleteTransaction,
  updateTransactionCategory,
  CurrencyMismatchError,
  CrossCurrencyTransferNotSupportedError,
  TransactionNotFoundError,
  CategoryNotFoundError,
} from "@/services/transaction/transaction";

const baseTx = {
  accountId: "acc_source",
  amount: "1500.00",
  currency: "KES" as const,
  description: "Test transaction",
  date: "2026-10-19T10:00:00.000Z",
};

describe("createTransactionSchema — type and amount rules", () => {
  const nonTransferTypes = [
    "INCOME",
    "REFUND",
    "EXPENSE",
    "WITHDRAWAL",
    "INVESTMENT_CONTRIBUTION",
  ] as const;

  it.each(nonTransferTypes)(
    "accepts %s when transferAccountId is absent",
    (type) => {
      const res = createTransactionSchema.safeParse({
        ...baseTx,
        type,
      });
      expect(res.success).toBe(true);
    }
  );

  it.each(nonTransferTypes)(
    "rejects %s when transferAccountId is provided",
    (type) => {
      const res = createTransactionSchema.safeParse({
        ...baseTx,
        type,
        transferAccountId: "acc_dest",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe(
          "Only transfers can have a destination account."
        );
      }
    }
  );

  it("accepts TRANSFER when transferAccountId is present and distinct from accountId", () => {
    const res = createTransactionSchema.safeParse({
      ...baseTx,
      type: "TRANSFER",
      transferAccountId: "acc_dest",
    });
    expect(res.success).toBe(true);
  });

  it("rejects TRANSFER without transferAccountId", () => {
    const res = createTransactionSchema.safeParse({
      ...baseTx,
      type: "TRANSFER",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(
        "Choose a destination account for a transfer."
      );
    }
  });

  it("rejects TRANSFER to the same account", () => {
    const res = createTransactionSchema.safeParse({
      ...baseTx,
      type: "TRANSFER",
      transferAccountId: "acc_source",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toBe(
        "Destination must be different from the source."
      );
    }
  });

  it("rejects zero and negative amounts", () => {
    expect(
      createTransactionSchema.safeParse({
        ...baseTx,
        type: "EXPENSE",
        amount: "0",
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        ...baseTx,
        type: "EXPENSE",
        amount: "0.00",
      }).success
    ).toBe(false);

    expect(
      createTransactionSchema.safeParse({
        ...baseTx,
        type: "EXPENSE",
        amount: "-100.00",
      }).success
    ).toBe(false);
  });
});

describe("createTransaction service", () => {
  beforeEach(() => {
    mockAccountFindUnique.mockReset();
    mockCategoryFindUnique.mockReset();
    mockTransactionCreate.mockReset();
    mockTransactionFindUnique.mockReset();
    mockTransactionFindMany.mockReset();
    mockTransactionUpdate.mockReset();
  });

  it("creates a non-transfer transaction with transferAccountId set to null", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "KES",
      isArchived: false,
    });
    mockTransactionCreate.mockResolvedValueOnce({ id: "tx_1" });

    await createTransaction("user_1", {
      ...baseTx,
      type: "EXPENSE",
    });

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          accountId: "acc_source",
          transferAccountId: null,
          type: "EXPENSE",
          amount: "1500.00",
          currency: "KES",
        }),
      })
    );
  });

  it("creates a valid same-currency TRANSFER between two active owned accounts", async () => {
    mockAccountFindUnique
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: false,
      })
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: false,
      });
    mockTransactionCreate.mockResolvedValueOnce({ id: "tx_transfer" });

    await createTransaction("user_1", {
      ...baseTx,
      type: "TRANSFER",
      transferAccountId: "acc_dest",
    });

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "acc_source",
          transferAccountId: "acc_dest",
          type: "TRANSFER",
        }),
      })
    );
  });

  it("rejects currency mismatch between transaction and source account", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "USD",
      isArchived: false,
    });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "EXPENSE",
        currency: "KES",
      })
    ).rejects.toThrow(CurrencyMismatchError);
  });

  it("rejects cross-currency TRANSFER with CrossCurrencyTransferNotSupportedError", async () => {
    mockAccountFindUnique
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: false,
      })
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "USD",
        isArchived: false,
      });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "TRANSFER",
        transferAccountId: "acc_usd",
        currency: "KES",
      })
    ).rejects.toThrow(CrossCurrencyTransferNotSupportedError);
  });

  it("rejects another user's source account with AccountNotFoundError", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_other",
      currency: "KES",
      isArchived: false,
    });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "EXPENSE",
      })
    ).rejects.toThrow(AccountNotFoundError);
  });

  it("rejects another user's destination account with AccountNotFoundError", async () => {
    mockAccountFindUnique
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: false,
      })
      .mockResolvedValueOnce({
        userId: "user_other",
        currency: "KES",
        isArchived: false,
      });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "TRANSFER",
        transferAccountId: "acc_other",
      })
    ).rejects.toThrow(AccountNotFoundError);
  });

  it("rejects archived source account and archived destination account", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "KES",
      isArchived: true,
    });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "EXPENSE",
      })
    ).rejects.toThrow(AccountNotFoundError);

    mockAccountFindUnique
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: false,
      })
      .mockResolvedValueOnce({
        userId: "user_1",
        currency: "KES",
        isArchived: true,
      });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "TRANSFER",
        transferAccountId: "acc_archived_dest",
      })
    ).rejects.toThrow(AccountNotFoundError);
  });

  it("rejects another user's custom category with CategoryNotFoundError", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "KES",
      isArchived: false,
    });
    mockCategoryFindUnique.mockResolvedValueOnce({
      userId: "user_other",
      isDefault: false,
    });

    await expect(
      createTransaction("user_1", {
        ...baseTx,
        type: "EXPENSE",
        categoryId: "cat_other",
      })
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it("accepts a shared default category", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "KES",
      isArchived: false,
    });
    mockCategoryFindUnique.mockResolvedValueOnce({
      userId: null,
      isDefault: true,
    });
    mockTransactionCreate.mockResolvedValueOnce({ id: "tx_cat" });

    await createTransaction("user_1", {
      ...baseTx,
      type: "EXPENSE",
      categoryId: "cat_default_food",
    });

    expect(mockTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat_default_food",
        }),
      })
    );
  });
});

describe("updateTransaction, softDeleteTransaction, updateTransactionCategory, and listTransactions", () => {
  beforeEach(() => {
    mockAccountFindUnique.mockReset();
    mockCategoryFindUnique.mockReset();
    mockTransactionFindUnique.mockReset();
    mockTransactionFindMany.mockReset();
    mockTransactionUpdate.mockReset();
  });

  it("updates editable fields after verifying ownership, active account, and category", async () => {
    mockTransactionFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      accountId: "acc_source",
      transferAccountId: null,
      type: "EXPENSE",
      currency: "KES",
      deletedAt: null,
    });
    mockAccountFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      currency: "KES",
      isArchived: false,
    });
    mockCategoryFindUnique.mockResolvedValueOnce({
      userId: null,
      isDefault: true,
    });
    mockTransactionUpdate.mockResolvedValueOnce({ id: "tx_1" });

    await updateTransaction("user_1", "tx_1", {
      amount: "2000.00",
      description: "Updated grocery run",
      notes: "Paid via M-Pesa",
      categoryId: "cat_default_food",
      date: "2026-10-20T08:00:00.000Z",
    });

    expect(mockTransactionUpdate).toHaveBeenCalledWith({
      where: { id: "tx_1" },
      data: {
        amount: "2000.00",
        description: "Updated grocery run",
        notes: "Paid via M-Pesa",
        categoryId: "cat_default_food",
        date: new Date("2026-10-20T08:00:00.000Z"),
      },
    });
  });

  it("rejects updating, deleting, or re-categorizing another user's transaction with TransactionNotFoundError", async () => {
    const otherUserTx = {
      userId: "user_other",
      accountId: "acc_source",
      transferAccountId: null,
      type: "EXPENSE",
      currency: "KES",
      deletedAt: null,
    };

    mockTransactionFindUnique.mockResolvedValueOnce(otherUserTx);
    await expect(
      updateTransaction("user_1", "tx_other", { description: "Hack" })
    ).rejects.toThrow(TransactionNotFoundError);

    mockTransactionFindUnique.mockResolvedValueOnce(otherUserTx);
    await expect(softDeleteTransaction("user_1", "tx_other")).rejects.toThrow(
      TransactionNotFoundError
    );

    mockTransactionFindUnique.mockResolvedValueOnce(otherUserTx);
    await expect(
      updateTransactionCategory("user_1", "tx_other", null)
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it("listTransactions applies filters, cursor pagination, user scoping, and returns amounts as strings", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({ userId: "user_1" });
    mockCategoryFindUnique.mockResolvedValueOnce({
      userId: "user_1",
      isDefault: false,
    });
    mockTransactionFindMany.mockResolvedValueOnce([
      {
        id: "tx_2",
        userId: "user_1",
        accountId: "acc_1",
        transferAccountId: null,
        categoryId: "cat_1",
        type: "EXPENSE",
        amount: "1250.5",
        currency: "KES",
        description: "Lunch",
        notes: null,
        date: new Date("2026-10-18T12:00:00Z"),
        createdAt: new Date("2026-10-18T12:00:00Z"),
        deletedAt: null,
        account: { id: "acc_1" },
        transferAccount: null,
        category: { id: "cat_1" },
      },
      {
        id: "tx_1",
        userId: "user_1",
        accountId: "acc_1",
        transferAccountId: null,
        categoryId: "cat_1",
        type: "EXPENSE",
        amount: "800",
        currency: "KES",
        description: "Coffee",
        notes: null,
        date: new Date("2026-10-17T09:00:00Z"),
        createdAt: new Date("2026-10-17T09:00:00Z"),
        deletedAt: null,
        account: { id: "acc_1" },
        transferAccount: null,
        category: { id: "cat_1" },
      },
    ]);

    const res = await listTransactions("user_1", {
      accountId: "acc_1",
      categoryId: "cat_1",
      type: "EXPENSE",
      from: "2026-10-01T00:00:00Z",
      to: "2026-10-31T23:59:59Z",
      limit: 1,
      cursor: "tx_3",
    });

    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.amount).toBe("1250.50");
    expect(res.nextCursor).toBe("tx_1");
  });

  it("listTransactions rejects filtering by another user's account or category with NotFoundError", async () => {
    mockAccountFindUnique.mockResolvedValueOnce({ userId: "user_other" });
    await expect(
      listTransactions("user_1", { accountId: "acc_other" })
    ).rejects.toThrow(AccountNotFoundError);

    mockCategoryFindUnique.mockResolvedValueOnce({
      userId: "user_other",
      isDefault: false,
    });
    await expect(
      listTransactions("user_1", { categoryId: "cat_other" })
    ).rejects.toThrow(CategoryNotFoundError);
  });
});
