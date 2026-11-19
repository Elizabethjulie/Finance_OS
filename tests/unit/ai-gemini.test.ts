import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  suggestCategoryWithMemory,
  generateInsightsWithMemory,
  generateDeterministicFallbackInsights,
} from "@/lib/ai/gemini";
import type { UserFinancialMemory } from "@/lib/ai/types";

// Mock @google/genai
const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
      ARRAY: "ARRAY",
    },
  };
});

describe("AI Integration: lib/ai/gemini.ts", () => {
  const sampleCategories = [
    { id: "cat_food", name: "Food & Dining" },
    { id: "cat_trans", name: "Transportation" },
    { id: "cat_util", name: "Utilities" },
    { id: "cat_shop", name: "Shopping" },
    { id: "cat_other", name: "Other" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test_gemini_api_key";
  });

  it("resolves merchant habits from user memory locally with 0 tokens consumed", async () => {
    const memory: UserFinancialMemory = {
      merchantHabits: {
        "artcaffe": "Food & Dining",
        "shell petrol": "Transportation",
      },
      primaryCurrency: "KES",
    };

    const result = await suggestCategoryWithMemory({
      description: "Artcaffe Galleria Lunch",
      amount: "2400.00",
      currency: "KES",
      categories: sampleCategories,
      memory,
    });

    expect(result).not.toBeNull();
    expect(result?.categoryId).toBe("cat_food");
    expect(result?.categoryName).toBe("Food & Dining");
    expect(result?.isFromLocalMemory).toBe(true);
    // Verifies that Gemini API was NOT called
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("resolves common Kenyan merchant rules locally with 0 tokens consumed", async () => {
    const result = await suggestCategoryWithMemory({
      description: "KPLC Prepaid Token 12345",
      amount: "1500.00",
      currency: "KES",
      categories: sampleCategories,
    });

    expect(result).not.toBeNull();
    expect(result?.categoryId).toBe("cat_util");
    expect(result?.categoryName).toBe("Utilities");
    expect(result?.isFromLocalMemory).toBe(true);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("invokes Gemini Flash with memory context when no local rule matches", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        categoryName: "Shopping",
        confidence: 0.92,
        reason: "Retail hardware purchase",
      }),
    });

    const memory: UserFinancialMemory = {
      merchantHabits: {},
      activeGoalsSummary: "Emergency Fund at 50%",
      primaryCurrency: "KES",
    };

    const result = await suggestCategoryWithMemory({
      description: "Nairobi Timber & Hardware",
      amount: "8500.00",
      currency: "KES",
      categories: sampleCategories,
      memory,
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    // Memory context was injected into prompt
    expect(callArgs.contents).toContain("Nairobi Timber & Hardware");
    expect(callArgs.contents).toContain("Emergency Fund at 50%");

    expect(result).not.toBeNull();
    expect(result?.categoryId).toBe("cat_shop");
    expect(result?.categoryName).toBe("Shopping");
    expect(result?.isFromLocalMemory).toBe(false);
  });

  it("fails open gracefully when Gemini API throws an error", async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini quota exceeded (429)"));

    const result = await suggestCategoryWithMemory({
      description: "Unknown Merchant Co.",
      amount: "5000.00",
      currency: "KES",
      categories: sampleCategories,
    });

    // Should return null rather than crashing the transaction flow
    expect(result).toBeNull();
  });

  it("generates deterministic fallback observations when Gemini is offline or fails", () => {
    const fallback = generateDeterministicFallbackInsights({
      period: { year: 2026, month: 11 },
      currency: "KES",
      summary: {
        income: "100000.00",
        spending: "75000.00",
        saved: "15000.00",
        invested: "10000.00",
        netCashFlow: "25000.00",
        topCategories: [{ name: "Transportation", amount: "18400.00" }],
      },
      budget: {
        totalAllocated: "70000.00",
        totalActual: "75000.00",
        overBudgetCategories: [
          { name: "Transportation", allocated: "15000.00", actual: "18400.00" },
        ],
      },
      goals: [
        {
          name: "Emergency Fund",
          currentAmount: "45000.00",
          targetAmount: "100000.00",
          percentComplete: "45",
          status: "ON_TRACK",
        },
      ],
    });

    expect(fallback.length).toBeGreaterThanOrEqual(3);
    const cashFlowInsight = fallback.find((i) => i.type === "CASH_FLOW_TREND");
    expect(cashFlowInsight?.title).toBe("Positive Net Cash Flow");
    expect(cashFlowInsight?.summary).toContain("25000.00 KES");

    const budgetInsight = fallback.find((i) => i.type === "SPENDING_ALERT");
    expect(budgetInsight?.title).toBe("Transportation Over Budget");
    expect(budgetInsight?.summary).toContain("18400.00 KES");
  });

  it("generates structured monthly insights using Gemini with memory injection", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          type: "CASH_FLOW_TREND",
          title: "Strong Monthly Surplus",
          summary: "You maintained a 25,000 KES cash surplus this month.",
          actionableStep: "Direct this surplus to your Emergency Fund.",
        },
        {
          type: "SPENDING_ALERT",
          title: "Transport Exceeded Budget",
          summary: "Transport reached 18,400 KES against the 15,000 KES target.",
          actionableStep: "Limit ride-hailing for the next two weeks.",
        },
      ]),
    });

    const memory: UserFinancialMemory = {
      merchantHabits: {},
      priorMonthTrajectory: "Prev Month: Transport was over-budget",
      primaryCurrency: "KES",
    };

    const insights = await generateInsightsWithMemory({
      period: { year: 2026, month: 11 },
      currency: "KES",
      summary: {
        income: "100000.00",
        spending: "75000.00",
        saved: "15000.00",
        invested: "10000.00",
        netCashFlow: "25000.00",
        topCategories: [{ name: "Transportation", amount: "18400.00" }],
      },
      goals: [],
      memory,
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents).toContain("Prev Month: Transport was over-budget");

    expect(insights).toHaveLength(2);
    expect(insights[0].type).toBe("CASH_FLOW_TREND");
    expect(insights[0].title).toBe("Strong Monthly Surplus");
    expect(insights[1].type).toBe("SPENDING_ALERT");
  });
});
