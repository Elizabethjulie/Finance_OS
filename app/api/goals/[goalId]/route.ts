import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { archiveGoal, GoalNotFoundError } from "@/services/goal/goal";

export async function DELETE(
  _request: Request,
  context: { params: { goalId: string } }
) {
  try {
    const userId = await requireUserId();
    await archiveGoal(userId, context.params.goalId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof GoalNotFoundError) {
      return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    }
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("DELETE /api/goals/[goalId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

