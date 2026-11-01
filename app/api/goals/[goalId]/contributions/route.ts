import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import { addGoalContributionSchema } from "@/lib/validation/goals";
import { addGoalContribution, GoalNotFoundError } from "@/services/goal/goal";
import { TransactionNotFoundError } from "@/services/transaction/transaction";

export async function POST(
  request: Request,
  context: { params: { goalId: string } }
) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const parsed = addGoalContributionSchema.safeParse({
      ...body,
      goalId: context.params.goalId,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid contribution data." },
        { status: 400 }
      );
    }

    const contribution = await addGoalContribution(userId, parsed.data);
    return NextResponse.json({ contribution }, { status: 201 });
  } catch (err) {
    if (err instanceof GoalNotFoundError) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }
    if (err instanceof TransactionNotFoundError) {
      return NextResponse.json(
        { error: "Linked transaction not found." },
        { status: 404 }
      );
    }
    if (err instanceof CurrencyMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("POST /api/goals/[goalId]/contributions failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

