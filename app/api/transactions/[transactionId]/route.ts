import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateTransactionSchema } from "@/lib/validation/transactions";
import { AccountNotFoundError } from "@/services/account/account";
import { CategoryNotFoundError } from "@/services/category/category";
import {
  updateTransaction,
  softDeleteTransaction,
  TransactionNotFoundError,
  CurrencyMismatchError,
  CrossCurrencyTransferNotSupportedError,
} from "@/services/transaction/transaction";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export async function PATCH(
  request: Request,
  context: { params: { transactionId: string } }
) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = updateTransactionSchema.parse(body);
    const tx = await updateTransaction(
      userId,
      context.params.transactionId,
      input
    );
    return NextResponse.json(
      {
        transaction: {
          ...tx,
          amount: formatAmount(toDecimal(String(tx.amount))),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid transaction update." },
        { status: 400 }
      );
    }
    if (
      err instanceof TransactionNotFoundError ||
      err instanceof AccountNotFoundError ||
      err instanceof CategoryNotFoundError
    ) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err instanceof CurrencyMismatchError ||
      err instanceof CrossCurrencyTransferNotSupportedError
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("PATCH /api/transactions/[transactionId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { transactionId: string } }
) {
  try {
    const userId = await requireUserId();
    await softDeleteTransaction(userId, context.params.transactionId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof TransactionNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("DELETE /api/transactions/[transactionId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

