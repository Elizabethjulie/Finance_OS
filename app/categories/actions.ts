"use server";

import { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import {
  createCategory,
  renameCategory,
  deleteCategory,
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
  DefaultCategoryImmutableError,
} from "@/services/category/category";

export interface CategoryActionState {
  error?: string;
  success?: boolean;
}

export async function createCategoryAction(
  _prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  try {
    const userId = await requireUserId();
    const rawIcon = String(formData.get("icon") ?? "").trim();
    await createCategory(userId, {
      name: String(formData.get("name") ?? ""),
      icon: rawIcon || undefined,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please check the category details." };
    }
    if (err instanceof CategoryAlreadyExistsError) {
      return { error: err.message };
    }
    console.error("createCategoryAction failed");
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function renameCategoryAction(
  categoryId: string,
  name: string
): Promise<CategoryActionState> {
  try {
    const userId = await requireUserId();
    await renameCategory(userId, categoryId, name);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please provide a valid category name." };
    }
    if (
      err instanceof CategoryAlreadyExistsError ||
      err instanceof CategoryNotFoundError ||
      err instanceof DefaultCategoryImmutableError
    ) {
      return { error: err.message };
    }
    console.error("renameCategoryAction failed");
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<CategoryActionState> {
  try {
    const userId = await requireUserId();
    await deleteCategory(userId, categoryId);
  } catch (err) {
    if (
      err instanceof CategoryNotFoundError ||
      err instanceof DefaultCategoryImmutableError
    ) {
      return { error: err.message };
    }
    console.error("deleteCategoryAction failed");
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  return { success: true };
}

