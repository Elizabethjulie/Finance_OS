import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import {
  listStoredMonthlyInsights,
  generateAndSaveMonthlyInsights,
} from "@/services/ai/insights";
import type { Currency } from "@/lib/generated/prisma/client";

const insightsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  currency: z.enum(["KES", "EUR", "GBP", "USD"]).default("KES"),
});

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);

    const query = insightsQuerySchema.parse({
      year: searchParams.get("year"),
      month: searchParams.get("month"),
      currency: searchParams.get("currency") ?? "KES",
    });

    const insights = await listStoredMonthlyInsights(userId, {
      year: query.year,
      month: query.month,
      currency: query.currency as Currency,
    });

    return NextResponse.json({ insights }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid query parameters." },
        { status: 400 }
      );
    }
    console.error("GET /api/ai/insights failed:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();

    const input = insightsQuerySchema.parse(body);

    const insights = await generateAndSaveMonthlyInsights(userId, {
      year: input.year,
      month: input.month,
      currency: input.currency as Currency,
    });

    return NextResponse.json({ insights }, { status: 201 });
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
    console.error("POST /api/ai/insights failed:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
