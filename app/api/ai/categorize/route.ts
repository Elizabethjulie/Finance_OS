import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { suggestCategoryForUser } from "@/services/ai/categorization";
import type { Currency } from "@/lib/generated/prisma/client";

const categorizeRequestSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  amount: z.string().optional(),
  currency: z.enum(["KES", "EUR", "GBP", "USD"]).optional(),
});

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = categorizeRequestSchema.parse(body);

    const suggestion = await suggestCategoryForUser(userId, {
      description: input.description,
      amount: input.amount || "0.00",
      currency: (input.currency as Currency) || "KES",
    });

    return NextResponse.json({ suggestion }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid input parameters." },
        { status: 400 }
      );
    }
    console.error("POST /api/ai/categorize failed:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
