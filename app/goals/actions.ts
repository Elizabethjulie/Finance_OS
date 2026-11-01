"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import { addGoalContributionSchema, createGoalSchema } from "@/lib/validation/goals";
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  GoalNotFoundError,
} from "@/services/goal/goal";
import { TransactionNotFoundError } from "@/services/transaction/transaction";

export type GoalActionState = {
  error?: string;
  success?: boolean;
};

export async function createGoalAction(
  _prevState: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  try {
    const userId = await requireUserId();
    const rawStarting = formData.get("startingAmount");

    const parsed = createGoalSchema.safeParse({
      name: formData.get("name"),
      type: formData.get("type") || "SAVINGS",
      targetAmount: formData.get("targetAmount"),
      startingAmount:
        typeof rawStarting === "string" && rawStarting.trim() !== ""
          ? rawStarting
          : "0",
      currency: formData.get("currency"),
      targetDate: formData.get("targetDate"),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Please check the goal details.",
      };
    }

    await createGoal(userId, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/goals");
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "Please log in to continue." };
    }
    return { error: "Could not create goal. Please try again." };
  }
}

export async function addGoalContributionAction(
  _prevState: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  try {
    const userId = await requireUserId();
    const rawTxId = formData.get("transactionId");
    const rawNote = formData.get("note");
    const rawDate = formData.get("contributedAt");

    const parsed = addGoalContributionSchema.safeParse({
      goalId: formData.get("goalId"),
      amount: formData.get("amount"),
      currency: formData.get("currency"),
      transactionId:
        typeof rawTxId === "string" && rawTxId.trim() !== "" ? rawTxId.trim() : undefined,
      note:
        typeof rawNote === "string" && rawNote.trim() !== "" ? rawNote.trim() : undefined,
      contributedAt:
        typeof rawDate === "string" && rawDate.trim() !== "" ? rawDate.trim() : undefined,
    });

    if (!parsed.success) {
      return {
        error:
          parsed.error.issues[0]?.message ?? "Please check the contribution details.",
      };
    }

    await addGoalContribution(userId, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/goals");
    return { success: true };
  } catch (err) {
    if (err instanceof GoalNotFoundError) {
      return { error: "Goal not found." };
    }
    if (err instanceof TransactionNotFoundError) {
      return { error: "Linked transaction not found." };
    }
    if (err instanceof CurrencyMismatchError) {
      return { error: err.message };
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "Please log in to continue." };
    }
    return { error: "Could not record contribution. Please try again." };
  }
}

export async function archiveGoalAction(goalId: string): Promise<GoalActionState> {
  try {
    const userId = await requireUserId();
    await archiveGoal(userId, goalId);
    revalidatePath("/dashboard");
    revalidatePath("/goals");
    return { success: true };
  } catch (err) {
    if (err instanceof GoalNotFoundError) {
      return { error: "Goal not found." };
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "Please log in to continue." };
    }
    return { error: "Could not archive goal. Please try again." };
  }
}

