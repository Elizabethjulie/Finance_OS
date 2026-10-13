"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { requireUserId } from "@/lib/auth/session";
import { createTransaction } from "@/services/transaction/transaction";
import { createAccount } from "@/services/account/account";
import { createTransactionSchema, type CreateTransactionInput } from "@/lib/validation/transactions";
import { createAccountSchema, type CreateAccountInput } from "@/lib/validation/accounts";

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createTransactionAction(input: CreateTransactionInput) {
  try {
    const userId = await requireUserId();
    const data = createTransactionSchema.parse(input);
    const result = await createTransaction(userId, data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounts");
    return { success: true, transaction: result };
  } catch (err: unknown) {
    console.error("createTransactionAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to create transaction" };
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