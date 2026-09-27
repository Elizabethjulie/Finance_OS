"use client";

import { useFormState } from "react-dom";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction, type LoginFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";

const initialState: LoginFormState = {};

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const justCreatedAccount = searchParams.get("message") === "account-created";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>

        {justCreatedAccount && (
          <p className="mt-2 rounded-md bg-accent/10 px-3 py-2 text-sm text-accent">
            Your account was created — log in to continue.
          </p>
        )}

        <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Input label="Email" name="email" type="email" autoComplete="email" required />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}

          <SubmitButton className="mt-2 w-full">Log in</SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </main>
  );
}