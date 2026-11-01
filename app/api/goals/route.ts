import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { createGoalSchema } from "@/lib/validation/goals";
import { createGoal, listGoalsWithProgress } from "@/services/goal/goal";

export async function GET() {
  try {
    const userId = await requireUserId();
    const goals = await listGoalsWithProgress(userId);
    return NextResponse.json({ goals }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("GET /api/goals failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const parsed = createGoalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid goal data." },
        { status: 400 }
      );
    }

    const goal = await createGoal(userId, parsed.data);
    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("POST /api/goals failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

