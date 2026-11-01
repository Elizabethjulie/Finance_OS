"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  generateBudgetSchema,
  updateBudgetAllocationsSchema,
  type UpdateBudgetAllocationsInput,
} from "@/lib/validation/budgets";
import {
  BudgetNotFoundError,
  generateAndSaveBudget,
  updateBudgetAllocations,
} from "@/services/budget/budget";
import { CategoryNotFoundError } from "@/services/category/category";

export type BudgetActionState = {
  error?: string;
  success?: boolean;
};

export async function generateBudgetAction(
  _prevState: BudgetActionState,
  formData: FormData
): Promise<BudgetActionState> {
  try {
    const userId = await requireUserId();
    const parsed = generateBudgetSchema.safeParse({
      year: formData.get("year"),
      month: formData.get("month"),
      currency: formData.get("currency"),
    });

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Please check the budget details.",
      };
    }

    await generateAndSaveBudget(userId, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/budgets");
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "Please log in to continue." };
    }
    return { error: "Could not generate budget. Please try again." };
  }
}

export async function updateBudgetAllocationsAction(
  budgetId: string,
  input: UpdateBudgetAllocationsInput
): Promise<BudgetActionState> {
  try {
    const userId = await requireUserId();
    const parsed = updateBudgetAllocationsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Please check the budget allocations.",
      };
    }

    await updateBudgetAllocations(userId, budgetId, parsed.data);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/budgets");
    revalidatePath("/budgets");
    return { success: true };
  } catch (err) {
    if (err instanceof BudgetNotFoundError) {
      return { error: "Budget not found." };
    }
    if (err instanceof CategoryNotFoundError) {
      return { error: "Category not found." };
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return { error: "Please log in to continue." };
    }
    return { error: "Could not update budget. Please try again." };
  }
}

