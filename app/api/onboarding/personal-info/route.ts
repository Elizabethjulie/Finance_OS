import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { personalInfoSchema } from "@/lib/validation/onboarding";
import { saveInitialPersonalInfo } from "@/services/onboarding/onboarding";

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = personalInfoSchema.parse(body);
    const user = await saveInitialPersonalInfo(userId, input);
    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid personal info." },
        { status: 400 }
      );
    }
    console.error("PATCH /api/onboarding/personal-info failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

