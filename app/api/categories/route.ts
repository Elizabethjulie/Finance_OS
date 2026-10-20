import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { createCategorySchema } from "@/lib/validation/transactions";
import {
  listCategories,
  createCategory,
  CategoryAlreadyExistsError,
} from "@/services/category/category";

export async function GET() {
  try {
    const userId = await requireUserId();
    const categories = await listCategories(userId);
    return NextResponse.json({ categories }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    console.error("GET /api/categories failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json();
    const input = createCategorySchema.parse(body);
    const category = await createCategory(userId, input);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid category details." },
        { status: 400 }
      );
    }
    if (err instanceof CategoryAlreadyExistsError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("POST /api/categories failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

