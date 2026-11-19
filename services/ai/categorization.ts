import { prisma } from "@/lib/db/prisma";
import type { Currency } from "@/lib/generated/prisma/client";
import { listCategories } from "@/services/category/category";
import { buildUserFinancialMemory } from "@/lib/ai/memory";
import { suggestCategoryWithMemory } from "@/lib/ai/gemini";
import type { CategorySuggestionResult } from "@/lib/ai/types";

/**
 * Extracts a concise merchant keyword from a transaction description string.
 * e.g., "Carrefour Two Rivers Branch" -> "carrefour"
 * e.g., "KPLC Prepaid Token 49302" -> "kplc"
 */
export function extractMerchantKeyword(description: string): string {
  const cleaned = description
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove punctuation
    .replace(/\s+/g, " ");

  const words = cleaned.split(" ").filter((w) => w.length > 1);
  if (words.length === 0) return cleaned;

  // Take the first 1-2 words as the merchant key (max 30 chars)
  const candidate = words.slice(0, 2).join(" ");
  return candidate.slice(0, 30).trim();
}

/**
 * Suggests a category for a user's transaction using local memory fast-path
 * and token-minimized Gemini Flash.
 */
export async function suggestCategoryForUser(
  userId: string,
  input: {
    description: string;
    amount?: string;
    currency?: Currency;
  }
): Promise<CategorySuggestionResult | null> {
  const { description, amount = "0.00", currency = "KES" } = input;
  if (!description.trim()) return null;

  // 1. Fetch user categories and compact financial memory
  const [categories, memory] = await Promise.all([
    listCategories(userId),
    buildUserFinancialMemory(userId, currency),
  ]);

  // 2. Query category suggestion engine
  return suggestCategoryWithMemory({
    description: description.trim(),
    amount,
    currency,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    memory,
  });
}

/**
 * Automatically saves or updates a user merchant keyword habit rule in the database.
 * This ensures the AI engine permanently remembers this merchant with 0 future token usage.
 */
export async function recordCategoryRule(
  userId: string,
  description: string,
  categoryId: string
): Promise<void> {
  const keyword = extractMerchantKeyword(description);
  if (!keyword || keyword.length < 2) return;

  try {
    await prisma.categoryCorrectionRule.upsert({
      where: {
        userId_keyword: {
          userId,
          keyword,
        },
      },
      update: {
        categoryId,
      },
      create: {
        userId,
        keyword,
        categoryId,
      },
    });
  } catch (err) {
    // Non-blocking background error logging
    console.warn(`[AI Memory] Failed to record rule for "${keyword}":`, err);
  }
}
