"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  createAccount,
  archiveAccount,
  AccountNotFoundError,
} from "@/services/account/account";
import type { CreateAccountInput } from "@/lib/validation/accounts";

export interface AccountFormState {
  error?: string;
  success?: boolean;
}

export async function createAccountAction(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  try {
    const userId = await requireUserId();
    const rawOpeningBalance = String(formData.get("openingBalance") ?? "").trim();
    await createAccount(userId, {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "") as CreateAccountInput["type"],
      currency: String(formData.get("currency") ?? "") as CreateAccountInput["currency"],
      openingBalance: rawOpeningBalance === "" ? "0" : rawOpeningBalance,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please check your details." };
    }
    console.error("create account failed", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archiveAccountAction(accountId: string): Promise<void> {
  try {
    const userId = await requireUserId();
    await archiveAccount(userId, accountId);
  } catch (err) {
    if (!(err instanceof AccountNotFoundError)) {
      console.error("archive account failed", err);
    }
  }
  revalidatePath("/accounts");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
}