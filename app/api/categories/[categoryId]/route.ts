import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { createCategorySchema } from "@/lib/validation/transactions";
import {
  renameCategory,
  deleteCategory,
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
  DefaultCategoryImmutableError,
} from "@/services/category/category";

export async function PATCH(
  request: Request,
  context: { params: { categoryId: string } }
) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const parsed = createCategorySchema.pick({ name: true }).parse(body);
    const category = await renameCategory(
      userId,
      context.params.categoryId,
      parsed.name
    );
    return NextResponse.json({ category }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid category name." },
        { status: 400 }
      );
    }
    if (err instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof DefaultCategoryImmutableError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof CategoryAlreadyExistsError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("PATCH /api/categories/[categoryId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { categoryId: string } }
) {
  try {
    const userId = await requireUserId();
    await deleteCategory(userId, context.params.categoryId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof CategoryNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof DefaultCategoryImmutableError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("DELETE /api/categories/[categoryId] failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

