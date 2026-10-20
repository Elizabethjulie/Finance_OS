import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { incomeStepSchema } from "@/lib/validation/onboarding";
import { completeOnboarding } from "@/services/onboarding/onboarding";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = incomeStepSchema.parse(body);
    const result = await completeOnboarding(userId, input);
    return NextResponse.json({ user: result }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid income sources." },
        { status: 400 }
      );
    }
    console.error("POST /api/onboarding/complete failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

