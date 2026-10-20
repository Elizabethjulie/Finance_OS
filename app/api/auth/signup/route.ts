import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { signupSchema } from "@/lib/validation/auth";
import { signupUser, EmailAlreadyExistsError } from "@/services/auth/signup";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = signupSchema.parse(body);
    const user = await signupUser(input);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid signup input." },
        { status: 400 }
      );
    }
    if (err instanceof EmailAlreadyExistsError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("POST /api/auth/signup failed");
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

