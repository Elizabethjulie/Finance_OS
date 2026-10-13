import { prisma } from "@/lib/db/prisma";
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
} from "@/lib/validation/accounts";

export async function ensureDefaultAccounts(userId: string) {
  const count = await prisma.account.count({ where: { userId } });
  if (count > 0) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { baseCurrency: true },
  });
  const currency = user?.baseCurrency ?? "USD";

  const defaultAccounts = [
    { name: "Chase Premier Checking", type: "BANK" as const, currency },
    { name: "Ally High-Yield Savings", type: "SAVINGS" as const, currency },
    { name: "M-Pesa / Mobile Wallet", type: "MOBILE_MONEY" as const, currency },
    { name: "Apple Cash / PayPal", type: "MOBILE_MONEY" as const, currency },
    { name: "Vanguard Prime MMF", type: "MMF" as const, currency },
    { name: "Everyday Wallet Cash", type: "CASH" as const, currency },
  ];

  await prisma.account.createMany({
    data: defaultAccounts.map((acc) => ({
      userId,
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
    })),
  });
}

export async function listAccounts(userId: string) {
  await ensureDefaultAccounts(userId);
  return prisma.account.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const data = createAccountSchema.parse(input);
  return prisma.account.create({
    data: { ...data, userId },
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