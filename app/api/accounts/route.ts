import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { createAccountSchema } from "@/lib/validation/accounts";
import { createAccount } from "@/services/account/account";
import { listAccountsWithBalances } from "@/services/account/balances";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export async function GET() {
  try {
    const userId = await requireUserId();
    const data = await listAccountsWithBalances(userId);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("GET /api/accounts failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = createAccountSchema.parse(body);
    const account = await createAccount(userId, input);
    return NextResponse.json(
      {
        account: {
          ...account,
          openingBalance: formatAmount(toDecimal(String(account.openingBalance ?? "0"))),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid account details." },
        { status: 400 }
      );
    }
    console.error("POST /api/accounts failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

