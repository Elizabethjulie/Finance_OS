import { GoogleGenAI, Type } from "@google/genai";
import type { Currency, InsightType } from "@/lib/generated/prisma/client";
import type {
  CategorySuggestionResult,
  GeneratedInsightItem,
  MonthlyInsightInput,
  UserFinancialMemory,
} from "./types";
import { formatMemoryForPrompt } from "./memory";

const DEFAULT_MERCHANT_KEYWORD_RULES: Record<string, string> = {
  kplc: "Utilities",
  "kenya power": "Utilities",
  safaricom: "Utilities",
  airtel: "Utilities",
  zuku: "Utilities",
  faiba: "Utilities",
  starlink: "Utilities",
  uber: "Transportation",
  bolt: "Transportation",
  "little cab": "Transportation",
  shell: "Transportation",
  total: "Transportation",
  rubis: "Transportation",
  petrol: "Transportation",
  fuel: "Transportation",
  matatu: "Transportation",
  carrefour: "Shopping",
  naivas: "Food & Dining",
  quickmart: "Food & Dining",
  chandarana: "Shopping",
  netflix: "Entertainment",
  spotify: "Entertainment",
  showmax: "Entertainment",
  cinema: "Entertainment",
  salary: "Salary & Wages",
  payroll: "Salary & Wages",
};

/**
 * Returns a configured GoogleGenAI client instance or null if no API key is present.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Categorizes a transaction description using:
 * 1. User memory & built-in keyword fast-path (0 tokens, 0ms, 100% offline).
 * 2. Token-minimized Gemini Flash structured prompt fallback.
 */
export async function suggestCategoryWithMemory(input: {
  description: string;
  amount: string;
  currency: Currency;
  categories: Array<{ id: string; name: string }>;
  memory?: UserFinancialMemory;
}): Promise<CategorySuggestionResult | null> {
  const { description, amount, currency, categories, memory } = input;
  const descLower = description.trim().toLowerCase();

  if (!descLower || categories.length === 0) return null;

  const categoryNameMap = new Map<string, { id: string; name: string }>();
  for (const cat of categories) {
    categoryNameMap.set(cat.name.trim().toLowerCase(), cat);
  }

  // Helper to find existing category by loose name matching
  function findCategory(targetName: string): { id: string; name: string } | undefined {
    const direct = categoryNameMap.get(targetName.trim().toLowerCase());
    if (direct) return direct;

    const lowerTarget = targetName.toLowerCase();
    for (const cat of categories) {
      const lower = cat.name.toLowerCase();
      if (lower.includes(lowerTarget) || lowerTarget.includes(lower)) {
        return cat;
      }
    }
    return undefined;
  }

  // --- Tier 1: Local Memory Fast-Path (0 Tokens Consumed) ---
  // A. Check user's saved merchant habits from memory
  if (memory?.merchantHabits) {
    for (const [kw, catName] of Object.entries(memory.merchantHabits)) {
      if (descLower.includes(kw.toLowerCase())) {
        const matched = findCategory(catName);
        if (matched) {
          return {
            categoryId: matched.id,
            categoryName: matched.name,
            confidence: 0.98,
            reason: `Matched saved habit for "${kw}"`,
            isFromLocalMemory: true,
          };
        }
      }
    }
  }

  // B. Check standard Kenyan/Global merchant rules
  for (const [kw, targetCatName] of Object.entries(DEFAULT_MERCHANT_KEYWORD_RULES)) {
    if (descLower.includes(kw)) {
      const matched = findCategory(targetCatName);
      if (matched) {
        return {
          categoryId: matched.id,
          categoryName: matched.name,
          confidence: 0.95,
          reason: `Matched merchant keyword "${kw}"`,
          isFromLocalMemory: true,
        };
      }
    }
  }

  // --- Tier 2: Token-Minimized Gemini Flash Fallback ---
  const ai = getGeminiClient();
  if (!ai) {
    // If no Gemini key is set, fail open without blocking the user
    return null;
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const memoryContext = formatMemoryForPrompt(memory);

    const prompt = [
      `Categorize this transaction.`,
      `Merchant/Description: "${description}"`,
      `Amount: ${amount} ${currency}`,
      `Available Categories: [${categories.map((c) => `"${c.name}"`).join(", ")}]`,
      memoryContext,
    ]
      .filter(Boolean)
      .join("\n");

    const schema = {
      type: Type.OBJECT,
      properties: {
        categoryName: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        reason: { type: Type.STRING },
      },
      required: ["categoryName", "confidence", "reason"],
    };

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          "You are a concise personal finance classifier for Finance OS. Choose the single best category from the available categories list. Be accurate and brief. Output ONLY valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text) as {
      categoryName: string;
      confidence: number;
      reason: string;
    };

    const matched = findCategory(parsed.categoryName);
    if (!matched) return null;

    return {
      categoryId: matched.id,
      categoryName: matched.name,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
      reason: parsed.reason || `Categorized as ${matched.name}`,
      isFromLocalMemory: false,
    };
  } catch (err) {
    console.warn("[Gemini AI] Categorization call failed, failing open gracefully:", err);
    return null;
  }
}

/**
 * Generates 3-4 structured monthly observations from verified mathematical facts.
 * Injects condensed financial memory for multi-month continuity with minimal tokens.
 */
export async function generateInsightsWithMemory(
  input: MonthlyInsightInput
): Promise<GeneratedInsightItem[]> {
  const { period, currency, summary, budget, goals, memory } = input;

  const fallbackInsights = generateDeterministicFallbackInsights(input);

  const ai = getGeminiClient();
  if (!ai) {
    return fallbackInsights;
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const memoryContext = formatMemoryForPrompt(memory);

    const factSheet = {
      period: `${period.year}-${String(period.month).padStart(2, "0")}`,
      currency,
      totals: {
        income: summary.income,
        spending: summary.spending,
        saved: summary.saved,
        invested: summary.invested,
        netCashFlow: summary.netCashFlow,
      },
      topSpendEnvelopes: summary.topCategories,
      budgetStatus: budget
        ? {
            allocated: budget.totalAllocated,
            actual: budget.totalActual,
            overBudgetEnvelopes: budget.overBudgetCategories,
          }
        : "No budget set for this month",
      activeGoals: goals.map((g) => ({
        name: g.name,
        progress: `${g.currentAmount} / ${g.targetAmount} (${g.percentComplete}%)`,
        status: g.status,
      })),
    };

    const prompt = [
      `Analyze these verified financial numbers for ${factSheet.period} (${currency}) and produce 3 to 4 high-signal observations.`,
      `Verified Data: ${JSON.stringify(factSheet)}`,
      memoryContext,
      `Rules:`,
      `1. Ground all claims in the provided verified data. Never calculate or invent numbers.`,
      `2. Keep summaries to 1-2 factual sentences with 1 practical action step.`,
      `3. Allowed types: SAVINGS_OPPORTUNITY, SPENDING_ALERT, GOAL_PROGRESS, CASH_FLOW_TREND.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: [
              "SAVINGS_OPPORTUNITY",
              "SPENDING_ALERT",
              "GOAL_PROGRESS",
              "CASH_FLOW_TREND",
            ],
          },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          actionableStep: { type: Type.STRING },
        },
        required: ["type", "title", "summary"],
      },
    };

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          "You are the Finance OS intelligence engine. You interpret verified financial facts with calm empathy and actionable precision. Never hallucinate numbers. Output ONLY valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      },
    });

    const text = response.text?.trim();
    if (!text) return fallbackInsights;

    const rawItems = JSON.parse(text) as Array<{
      type: InsightType;
      title: string;
      summary: string;
      actionableStep?: string;
    }>;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return fallbackInsights;
    }

    return rawItems.map((item) => ({
      type: item.type,
      title: item.title,
      summary: item.summary,
      actionableStep: item.actionableStep,
      reasoning: {
        period: `${period.year}-${period.month}`,
        currency,
        netCashFlow: summary.netCashFlow,
        totalSpending: summary.spending,
      },
    }));
  } catch (err) {
    console.warn("[Gemini AI] Insights generation failed, using deterministic fallback:", err);
    return fallbackInsights;
  }
}

/**
 * Deterministic mathematical fallback insights when offline, testing, or API is unavailable.
 */
export function generateDeterministicFallbackInsights(
  input: MonthlyInsightInput
): GeneratedInsightItem[] {
  const { period, currency, summary, budget, goals } = input;
  const items: GeneratedInsightItem[] = [];

  // 1. Cash flow direction observation
  const netNum = Number(summary.netCashFlow);
  if (netNum > 0) {
    items.push({
      type: "CASH_FLOW_TREND",
      title: "Positive Net Cash Flow",
      summary: `You retained a surplus of ${summary.netCashFlow} ${currency} this month after meeting all recorded expenses.`,
      actionableStep: "Consider allocating this surplus toward your active emergency fund or savings goals.",
      reasoning: { netCashFlow: summary.netCashFlow, income: summary.income, spending: summary.spending },
    });
  } else if (netNum < 0) {
    items.push({
      type: "CASH_FLOW_TREND",
      title: "Deficit Cash Flow Alert",
      summary: `Total spending exceeded income by ${Math.abs(netNum).toFixed(2)} ${currency} this period.`,
      actionableStep: "Review discretionary spending envelopes to bring cash flow back into balance.",
      reasoning: { netCashFlow: summary.netCashFlow, deficit: Math.abs(netNum).toFixed(2) },
    });
  }

  // 2. Budget envelope status
  if (budget && budget.overBudgetCategories.length > 0) {
    const topOver = budget.overBudgetCategories[0];
    items.push({
      type: "SPENDING_ALERT",
      title: `${topOver.name} Over Budget`,
      summary: `${topOver.name} reached ${topOver.actual} ${currency}, exceeding its allocation of ${topOver.allocated} ${currency}.`,
      actionableStep: "Cap flexible spending in this category for the remainder of the month.",
      reasoning: { category: topOver.name, allocated: topOver.allocated, actual: topOver.actual },
    });
  }

  // 3. Goal milestone progress
  if (goals.length > 0) {
    const topGoal = goals[0];
    items.push({
      type: "GOAL_PROGRESS",
      title: `${topGoal.name} Progress`,
      summary: `${topGoal.name} has reached ${topGoal.percentComplete}% completion (${topGoal.currentAmount} of ${topGoal.targetAmount} ${currency}).`,
      actionableStep: "Maintain your scheduled monthly contributions to stay on target for completion.",
      reasoning: { goal: topGoal.name, percent: topGoal.percentComplete, target: topGoal.targetAmount },
    });
  }

  // Fallback default if no other insights matched
  if (items.length === 0) {
    items.push({
      type: "SAVINGS_OPPORTUNITY",
      title: "Monthly Financial Baseline",
      summary: `Total spending recorded for ${period.month}/${period.year} is ${summary.spending} ${currency}.`,
      actionableStep: "Add a monthly budget or set savings goals to unlock detailed progress tracking.",
      reasoning: { spending: summary.spending, currency },
    });
  }

  return items;
}
