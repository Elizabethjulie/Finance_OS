"use server";

import { ZodError } from "zod";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { signupUser, EmailAlreadyExistsError } from "@/services/auth/signup";

export interface SignupFormState {
  error?: string;
}

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  try {
    await signupUser(raw);
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      return { error: err.message };
    }
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please check your details and try again." };
    }
    console.error("signup failed", err);
    return { error: "Something went wrong on our end. Please try again." };
  }

  try {
    await signIn("credentials", { email: raw.email, password: raw.password, redirect: false });
  } catch (err) {
    console.error("auto sign-in after signup failed", err);
    redirect("/login?message=account-created");
  }

  redirect("/onboarding");
}