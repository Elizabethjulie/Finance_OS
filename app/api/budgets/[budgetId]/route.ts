import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { updateBudgetAllocationsSchema } from "@/lib/validation/budgets";
import { BudgetNotFoundError, updateBudgetAllocations } from "@/services/budget/budget";
import { CategoryNotFoundError } from "@/services/category/category";

export async function PATCH(
  request: Request,
  context: { params: { budgetId: string } }
) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const parsed = updateBudgetAllocationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid budget allocations." },
        { status: 400 }
      );
    }

    const budget = await updateBudgetAllocations(
      userId,
      context.params.budgetId,
      parsed.data
    );
    return NextResponse.json({ budget }, { status: 200 });
  } catch (err) {
    if (err instanceof BudgetNotFoundError) {
      return NextResponse.json({ error: "Budget not found." }, { status: 404 });
    }
    if (err instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("PATCH /api/budgets/[budgetId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

