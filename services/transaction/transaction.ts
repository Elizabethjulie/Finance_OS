import { prisma } from "@/lib/db/prisma";
import { createTransactionSchema, type CreateTransactionInput } from "@/lib/validation/transactions";
import { AccountNotFoundError } from "@/services/account/account";

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found.");
    this.name = "TransactionNotFoundError";
  }
}

export async function listTransactions(userId: string, limit = 50) {
  return prisma.transaction.findMany({
    where: { userId, deletedAt: null },
    include: { account: true, category: true },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function createTransaction(userId: string, input: CreateTransactionInput) {
  const data = createTransactionSchema.parse(input);

  // Verify the account actually belongs to this user before attaching a
  // transaction to it — without this check, a crafted accountId from
  // another user would silently succeed and the transaction would be
  // invisible to its real owner but counted against someone else's
  // account balance.
  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
    select: { userId: true },
  });
  if (!account || account.userId !== userId) {
    throw new AccountNotFoundError();
  }

  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { userId: true, isDefault: true },
    });
    const belongsToUser = category?.userId === userId;
    const isSharedDefault = category?.isDefault === true;
    if (!category || (!belongsToUser && !isSharedDefault)) {
      throw new Error("Invalid category.");
    }
  }

  return prisma.transaction.create({
    data: {
      userId,
      accountId: data.accountId,
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

export async function softDeleteTransaction(userId: string, transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true },
  });
  if (!transaction || transaction.userId !== userId) {
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
    select: { userId: true },
  });
  if (!transaction || transaction.userId !== userId) {
    throw new TransactionNotFoundError();
  }

  return prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId },
  });
}