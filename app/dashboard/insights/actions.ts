"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth/session";
import { generateAndSaveMonthlyInsights, dismissInsight } from "@/services/ai/insights";
import type { Currency } from "@/lib/generated/prisma/client";

export async function generateInsightsAction(input: {
  year: number;
  month: number;
  currency: Currency;
}) {
  try {
    const userId = await requireUserId();
    const insights = await generateAndSaveMonthlyInsights(userId, input);
    revalidatePath("/dashboard/insights");
    return { success: true, insights };
  } catch (err: unknown) {
    console.error("generateInsightsAction error:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to generate financial insights",
    };
  }
}

export async function dismissInsightAction(insightId: string) {
  try {
    const userId = await requireUserId();
    const success = await dismissInsight(userId, insightId);
    revalidatePath("/dashboard/insights");
    return { success };
  } catch (err: unknown) {
    console.error("dismissInsightAction error:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to dismiss insight",
    };
  }
}
