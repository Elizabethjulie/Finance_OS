import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateAccountSchema } from "@/lib/validation/accounts";
import {
  updateAccount,
  archiveAccount,
  AccountNotFoundError,
} from "@/services/account/account";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export async function PATCH(
  request: Request,
  context: { params: { accountId: string } }
) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = updateAccountSchema.parse(body);
    const account = await updateAccount(userId, context.params.accountId, input);
    return NextResponse.json(
      {
        account: {
          ...account,
          openingBalance: formatAmount(toDecimal(String(account.openingBalance ?? "0"))),
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
        { error: err.issues[0]?.message ?? "Invalid account update." },
        { status: 400 }
      );
    }
    if (err instanceof AccountNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("PATCH /api/accounts/[accountId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { accountId: string } }
) {
  try {
    const userId = await requireUserId();
    await archiveAccount(userId, context.params.accountId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof AccountNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("DELETE /api/accounts/[accountId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

