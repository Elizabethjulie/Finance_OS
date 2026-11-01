import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { Currency } from "@/lib/generated/prisma/client";
import { generateBudgetSchema } from "@/lib/validation/budgets";
import { generateAndSaveBudget, getBudgetWithActuals } from "@/services/budget/budget";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const now = new Date();

    const parsed = generateBudgetSchema.safeParse({
      year: searchParams.get("year") ?? now.getUTCFullYear(),
      month: searchParams.get("month") ?? now.getUTCMonth() + 1,
      currency: searchParams.get("currency") ?? Currency.KES,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query parameters." },
        { status: 400 }
      );
    }

    const budget = await getBudgetWithActuals(userId, parsed.data);
    return NextResponse.json({ budget }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("GET /api/budgets failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const parsed = generateBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid budget request." },
        { status: 400 }
      );
    }

    const budget = await generateAndSaveBudget(userId, parsed.data);
    return NextResponse.json({ budget }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("POST /api/budgets failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

