import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { getDashboardSummary } from "@/services/dashboard/summary";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    const year = yearParam ? Number(yearParam) : now.getUTCFullYear();
    const month = monthParam ? Number(monthParam) : now.getUTCMonth() + 1;

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Provide a valid integer year and month (1..12)." },
        { status: 400 }
      );
    }

    const summary = await getDashboardSummary(userId, { year, month });
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("GET /api/dashboard/summary failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

