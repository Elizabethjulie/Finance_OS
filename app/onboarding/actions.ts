"use server";

import { ZodError } from "zod";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { saveInitialPersonalInfo, completeOnboarding } from "@/services/onboarding/onboarding";
import type { PersonalInfoInput, IncomeStepInput } from "@/lib/validation/onboarding";

export interface OnboardingActionState {
  error?: string;
}

export async function savePersonalInfoAction(
  input: PersonalInfoInput
): Promise<OnboardingActionState> {
  try {
    const userId = await requireUserId();
    await saveInitialPersonalInfo(userId, input);
    return {};
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please check your details." };
    }
    console.error("save personal info failed", err);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function completeOnboardingAction(
  input: IncomeStepInput
): Promise<OnboardingActionState> {
  try {
    const userId = await requireUserId();
    await completeOnboarding(userId, input);
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: err.issues[0]?.message ?? "Please check your income details." };
    }
    console.error("complete onboarding failed", err);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/dashboard");
}