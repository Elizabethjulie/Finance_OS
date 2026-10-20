import { prisma } from "@/lib/db/prisma";
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/lib/validation/accounts";

export async function listAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const data = createAccountSchema.parse(input);
  return prisma.account.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      currency: data.currency,
      openingBalance: data.openingBalance,
    },
  });
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found.");
    this.name = "AccountNotFoundError";
  }
}

async function assertOwnership(userId: string, accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!account || account.userId !== userId) {
    throw new AccountNotFoundError();
  }
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: UpdateAccountInput
) {
  await assertOwnership(userId, accountId);
  const data = updateAccountSchema.parse(input);
  return prisma.account.update({
    where: { id: accountId },
    data,
  });
}

export async function archiveAccount(userId: string, accountId: string) {
  await assertOwnership(userId, accountId);
  return prisma.account.update({
    where: { id: accountId },
    data: { isArchived: true },
  });
}