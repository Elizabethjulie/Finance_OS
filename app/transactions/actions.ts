"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { AccountNotFoundError } from "@/services/account/account";
import { CategoryNotFoundError } from "@/services/category/category";
import {
  createTransaction,
  updateTransaction,
  softDeleteTransaction,
  updateTransactionCategory,
  TransactionNotFoundError,
  CurrencyMismatchError,
  CrossCurrencyTransferNotSupportedError,
} from "@/services/transaction/transaction";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/lib/validation/transactions";

export interface TransactionFormState {
  error?: string;
  success?: boolean;
}

function mapTransactionError(err: unknown): string {
  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "Please check your transaction details.";
  }
  if (
    err instanceof AccountNotFoundError ||
    err instanceof CategoryNotFoundError ||
    err instanceof TransactionNotFoundError ||
    err instanceof CurrencyMismatchError ||
    err instanceof CrossCurrencyTransferNotSupportedError
  ) {
    return err.message;
  }
  console.error("transaction action failed");
  return "Something went wrong. Please try again.";
}

export async function createTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  try {
    const userId = await requireUserId();
    const rawCategoryId = String(formData.get("categoryId") ?? "").trim();
    const rawTransferAccountId = String(formData.get("transferAccountId") ?? "").trim();
    const rawNotes = String(formData.get("notes") ?? "").trim();

    await createTransaction(userId, {
      accountId: String(formData.get("accountId") ?? ""),
      transferAccountId: rawTransferAccountId || undefined,
      categoryId: rawCategoryId || undefined,
      type: String(formData.get("type") ?? "") as CreateTransactionInput["type"],
      amount: String(formData.get("amount") ?? ""),
      currency: String(formData.get("currency") ?? "") as CreateTransactionInput["currency"],
      description: String(formData.get("description") ?? ""),
      notes: rawNotes || undefined,
      date: String(formData.get("date") ?? ""),
    });
  } catch (err) {
    return { error: mapTransactionError(err) };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function deleteTransactionAction(
  transactionId: string
): Promise<TransactionFormState> {
  try {
    const userId = await requireUserId();
    await softDeleteTransaction(userId, transactionId);
  } catch (err) {
    return { error: mapTransactionError(err) };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  return { success: true };
}

export async function updateTransactionCategoryAction(
  transactionId: string,
  categoryId: string | null
): Promise<TransactionFormState> {
  try {
    const userId = await requireUserId();
    await updateTransactionCategory(userId, transactionId, categoryId);
  } catch (err) {
    return { error: mapTransactionError(err) };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransactionAction(
  transactionId: string,
  input: UpdateTransactionInput
): Promise<TransactionFormState> {
  try {
    const userId = await requireUserId();
    await updateTransaction(userId, transactionId, input);
  } catch (err) {
    return { error: mapTransactionError(err) };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  return { success: true };
}

