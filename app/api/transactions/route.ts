import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import type { TransactionType } from "@/lib/generated/prisma/client";
import { createTransactionSchema } from "@/lib/validation/transactions";
import { AccountNotFoundError } from "@/services/account/account";
import { CategoryNotFoundError } from "@/services/category/category";
import {
  listTransactions,
  createTransaction,
  CurrencyMismatchError,
  CrossCurrencyTransferNotSupportedError,
} from "@/services/transaction/transaction";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const accountId = searchParams.get("accountId") ?? undefined;
    const type = (searchParams.get("type") ?? undefined) as
      | TransactionType
      | undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await listTransactions(userId, {
      from,
      to,
      categoryId,
      accountId,
      type,
      cursor,
      limit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof AccountNotFoundError || err instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("GET /api/transactions failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = createTransactionSchema.parse(body);
    const tx = await createTransaction(userId, input);
    return NextResponse.json(
      {
        transaction: {
          ...tx,
          amount: formatAmount(toDecimal(String(tx.amount))),
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
        { error: err.issues[0]?.message ?? "Invalid transaction details." },
        { status: 400 }
      );
    }
    if (err instanceof AccountNotFoundError || err instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err instanceof CurrencyMismatchError ||
      err instanceof CrossCurrencyTransferNotSupportedError
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("POST /api/transactions failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

