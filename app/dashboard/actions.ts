"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createTransaction } from "@/services/transaction/transaction";
import { createAccount } from "@/services/account/account";
import { suggestCategoryForUser, recordCategoryRule } from "@/services/ai/categorization";
import { createTransactionSchema, type CreateTransactionInput } from "@/lib/validation/transactions";
import { createAccountSchema, type CreateAccountInput } from "@/lib/validation/accounts";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createTransactionAction(input: CreateTransactionInput & { categoryName?: string }) {
  try {
    const userId = await requireUserId();
    const rawInput = { ...input };

    if (!rawInput.categoryId && input.categoryName) {
      const name = input.categoryName.trim();
      const cat = await prisma.category.findFirst({
        where: {
          OR: [{ userId }, { userId: null, isDefault: true }],
          name: { equals: name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (cat) {
        rawInput.categoryId = cat.id;
      } else {
        const cats = await prisma.category.findMany({
          where: { OR: [{ userId }, { userId: null, isDefault: true }] },
          select: { id: true, name: true },
        });
        const lowerName = name.toLowerCase();
        const matched = cats.find((c) => {
          const cLower = c.name.toLowerCase();
          return lowerName.includes(cLower) || cLower.includes(lowerName);
        });
        if (matched) rawInput.categoryId = matched.id;
      }
    }

    const data = createTransactionSchema.parse(rawInput);
    const result = await createTransaction(userId, data);

    // Record merchant habit in user's long-term memory (non-blocking)
    if (data.categoryId && data.description) {
      await recordCategoryRule(userId, data.description, data.categoryId);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/dashboard/insights");
    return { success: true, transaction: result };
  } catch (err: unknown) {
    console.error("createTransactionAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create transaction" };
  }
}

export async function suggestCategoryAction(input: {
  description: string;
  amount?: string;
  currency?: "KES" | "EUR" | "USD" | "GBP";
}) {
  try {
    const userId = await requireUserId();
    const suggestion = await suggestCategoryForUser(userId, input);
    return { success: true, suggestion };
  } catch (err: unknown) {
    console.error("suggestCategoryAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to suggest category" };
  }
}

export async function createAccountAction(input: CreateAccountInput) {
  try {
    const userId = await requireUserId();
    const data = createAccountSchema.parse(input);
    const result = await createAccount(userId, data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    return { success: true, account: result };
  } catch (err: unknown) {
    console.error("createAccountAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create account" };
  }
}

export async function syncBalancesAction() {
  await requireUserId();
  // Simulate banking reconciliation and refresh
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  return { success: true, syncedAt: new Date().toISOString() };
}

export async function updateBaseCurrencyAction(currency: "KES" | "EUR" | "USD" | "GBP") {
  try {
    const userId = await requireUserId();
    const validCurrencies = ["KES", "EUR", "USD", "GBP"] as const;
    if (!validCurrencies.includes(currency)) {
      return { error: "Invalid currency selected" };
    }
    await prisma.user.update({
      where: { id: userId },
      data: { baseCurrency: currency },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/dashboard/insights");
    return { success: true };
  } catch (err: unknown) {
    console.error("updateBaseCurrencyAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to update currency" };
  }
}
