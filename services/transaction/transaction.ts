import { prisma } from "@/lib/db/prisma";
import type {
  Account,
  Category,
  Prisma,
  Transaction,
  TransactionType,
} from "@/lib/generated/prisma/client";
import {
  createTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/lib/validation/transactions";
import { AccountNotFoundError } from "@/services/account/account";
import { CategoryNotFoundError } from "@/services/category/category";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export { CurrencyMismatchError, CategoryNotFoundError };

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found.");
    this.name = "TransactionNotFoundError";
  }
}

export class CrossCurrencyTransferNotSupportedError extends Error {
  constructor(
    message = "Transfers between accounts with different currencies are not yet supported."
  ) {
    super(message);
    this.name = "CrossCurrencyTransferNotSupportedError";
  }
}

export interface ListTransactionsFilters {
  from?: Date | string;
  to?: Date | string;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  limit?: number;
  cursor?: string;
}

export type TransactionWithRelations = Transaction & {
  account: Account;
  transferAccount: Account | null;
  category: Category | null;
};

export type SerializedTransaction = Omit<TransactionWithRelations, "amount"> & {
  amount: string;
};

export interface ListTransactionsResult {
  items: SerializedTransaction[];
  nextCursor: string | null;
}

async function assertCategoryAccess(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { userId: true, isDefault: true },
  });
  const belongsToUser = category?.userId === userId;
  const isSharedDefault = category?.isDefault === true;
  if (!category || (!belongsToUser && !isSharedDefault)) {
    throw new CategoryNotFoundError();
  }
}

export async function listTransactions(
  userId: string,
  limit: number
): Promise<TransactionWithRelations[]>;
export async function listTransactions(
  userId: string,
  filters?: ListTransactionsFilters
): Promise<ListTransactionsResult>;
export async function listTransactions(
  userId: string,
  filtersOrLimit?: number | ListTransactionsFilters
): Promise<TransactionWithRelations[] | ListTransactionsResult> {
  if (typeof filtersOrLimit === "number") {
    return prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      include: { account: true, transferAccount: true, category: true },
      orderBy: { date: "desc" },
      take: filtersOrLimit,
    });
  }

  const filters = filtersOrLimit ?? {};
  const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  if (filters.accountId) {
    const acc = await prisma.account.findUnique({
      where: { id: filters.accountId },
      select: { userId: true },
    });
    if (!acc || acc.userId !== userId) {
      throw new AccountNotFoundError();
    }
  }

  if (filters.categoryId) {
    await assertCategoryAccess(userId, filters.categoryId);
  }

  const dateFilter: Prisma.DateTimeFilter = {};
  if (filters.from) {
    dateFilter.gte = filters.from instanceof Date ? filters.from : new Date(filters.from);
  }
  if (filters.to) {
    dateFilter.lte = filters.to instanceof Date ? filters.to : new Date(filters.to);
  }

  const where: Prisma.TransactionWhereInput = {
    userId,
    deletedAt: null,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.accountId
      ? {
          OR: [
            { accountId: filters.accountId },
            { transferAccountId: filters.accountId },
          ],
        }
      : {}),
    ...(filters.from || filters.to ? { date: dateFilter } : {}),
  };

  const rows = await prisma.transaction.findMany({
    where,
    include: { account: true, transferAccount: true, category: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor
      ? {
          cursor: { id: filters.cursor },
          skip: 1,
        }
      : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const nextItem = rows.pop();
    nextCursor = nextItem?.id ?? null;
  }

  const items: SerializedTransaction[] = rows.map((row) => ({
    ...row,
    amount: formatAmount(toDecimal(String(row.amount))),
  }));

  return { items, nextCursor };
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  const data = createTransactionSchema.parse(input);

  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
    select: { userId: true, currency: true, isArchived: true },
  });
  if (!account || account.userId !== userId || account.isArchived) {
    throw new AccountNotFoundError();
  }

  if (data.currency !== account.currency) {
    throw new CurrencyMismatchError();
  }

  const transferAccountId =
    data.type === "TRANSFER" && data.transferAccountId ? data.transferAccountId : null;

  if (data.type === "TRANSFER" && transferAccountId) {
    const destAccount = await prisma.account.findUnique({
      where: { id: transferAccountId },
      select: { userId: true, currency: true, isArchived: true },
    });
    if (!destAccount || destAccount.userId !== userId || destAccount.isArchived) {
      throw new AccountNotFoundError();
    }
    if (destAccount.currency !== account.currency) {
      throw new CrossCurrencyTransferNotSupportedError();
    }
  }

  if (data.categoryId) {
    await assertCategoryAccess(userId, data.categoryId);
  }

  return prisma.transaction.create({
    data: {
      userId,
      accountId: data.accountId,
      transferAccountId,
      categoryId: data.categoryId || null,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      notes: data.notes || null,
      date: new Date(data.date),
    },
  });
}

/**
 * Updates editable fields on an existing transaction (`description`, `notes`,
 * `date`, `categoryId`, `amount`). Editing `type`, `accountId`, `transferAccountId`,
 * or `currency` is not allowed in this step — delete and recreate the transaction
 * instead so balance and currency invariants cannot be violated retroactively.
 */
export async function updateTransaction(
  userId: string,
  id: string,
  input: UpdateTransactionInput
) {
  const data = updateTransactionSchema.parse(input);

  const existing = await prisma.transaction.findUnique({
    where: { id },
    select: {
      userId: true,
      accountId: true,
      transferAccountId: true,
      type: true,
      currency: true,
      deletedAt: true,
    },
  });
  if (!existing || existing.userId !== userId || existing.deletedAt !== null) {
    throw new TransactionNotFoundError();
  }

  const account = await prisma.account.findUnique({
    where: { id: existing.accountId },
    select: { userId: true, currency: true, isArchived: true },
  });
  if (!account || account.userId !== userId || account.isArchived) {
    throw new AccountNotFoundError();
  }

  if (existing.currency !== account.currency) {
    throw new CurrencyMismatchError();
  }

  if (existing.type === "TRANSFER") {
    if (!existing.transferAccountId || existing.transferAccountId === existing.accountId) {
      throw new AccountNotFoundError();
    }
    const destAccount = await prisma.account.findUnique({
      where: { id: existing.transferAccountId },
      select: { userId: true, currency: true, isArchived: true },
    });
    if (!destAccount || destAccount.userId !== userId || destAccount.isArchived) {
      throw new AccountNotFoundError();
    }
    if (destAccount.currency !== account.currency) {
      throw new CrossCurrencyTransferNotSupportedError();
    }
  }

  if (data.categoryId) {
    await assertCategoryAccess(userId, data.categoryId);
  }

  return prisma.transaction.update({
    where: { id },
    data: {
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId || null } : {}),
    },
  });
}

export async function softDeleteTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true, deletedAt: true },
  });
  if (!transaction || transaction.userId !== userId || transaction.deletedAt !== null) {
    throw new TransactionNotFoundError();
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { deletedAt: new Date() },
  });
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  categoryId: string | null
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true, deletedAt: true },
  });
  if (!transaction || transaction.userId !== userId || transaction.deletedAt !== null) {
    throw new TransactionNotFoundError();
  }

  if (categoryId) {
    await assertCategoryAccess(userId, categoryId);
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });
}