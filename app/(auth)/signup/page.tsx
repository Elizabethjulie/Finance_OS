"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signupAction, type SignupFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";

const initialState: SignupFormState = {};

export default function SignupPage() {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Takes about a minute. We'll ask about your finances next.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
          <Input label="Name" name="name" type="text" autoComplete="name" required />
          <Input label="Email" name="email" type="email" autoComplete="email" required />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="-mt-2 text-xs text-muted">
            At least 8 characters, with a letter and a number.
          </p>

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}

          <SubmitButton className="mt-2 w-full">Create account</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  );
}