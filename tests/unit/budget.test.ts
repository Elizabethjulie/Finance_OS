import { describe, expect, it } from "vitest";
import {
  computeBudgetVsActual,
  generateGoalBasedBudget,
  normalizeMonthlyIncome,
} from "@/lib/finance/budget";

describe("Phase 4: Goal-based budget allocator (lib/finance/budget.ts)", () => {
  it("normalizes monthly income and applies a 20% safety discount to IRREGULAR income", () => {
    const { monthlyIncome, hasIrregularIncome } = normalizeMonthlyIncome(
      [
        {
          amount: "100000.00",
          currency: "KES",
          frequency: "MONTHLY",
          isActive: true,
        },
        {
          amount: "50000.00",
          currency: "KES",
          frequency: "IRREGULAR",
          isActive: true,
        },
      ],
      "KES"
    );

    // 100,000 + (50,000 * 0.80) = 140,000
    expect(hasIrregularIncome).toBe(true);
    expect(monthlyIncome.toFixed(2)).toBe("140000.00");
  });

  it("allocates essentials first, then active goal targets, then discretionary categories with rationale (excluding rent and food)", () => {
    const plan = generateGoalBasedBudget({
      currency: "KES",
      incomeSources: [
        {
          amount: "100000.00",
          currency: "KES",
          frequency: "MONTHLY",
          isActive: true,
        },
      ],
      historicalSpending: [
        { categoryId: "cat_utilities", categoryName: "Utilities", averageMonthlySpend: "25000.00" },
        { categoryId: "cat_transport", categoryName: "Transport", averageMonthlySpend: "15000.00" },
        {
          categoryId: "cat_shopping",
          categoryName: "Shopping",
          averageMonthlySpend: "10000.00",
        },
      ],
      goals: [
        {
          goalId: "g_ef",
          name: "Emergency Fund",
          type: "EMERGENCY_FUND",
          requiredMonthlyContribution: "20000.00",
        },
        {
          goalId: "g_inv",
          name: "MMF Growth",
          type: "INVESTMENT",
          requiredMonthlyContribution: "10000.00",
        },
      ],
      categories: [
        { id: "cat_utilities", name: "Utilities" },
        { id: "cat_transport", name: "Transport" },
        { id: "cat_savings", name: "Savings" },
        { id: "cat_investment", name: "Investment" },
        { id: "cat_shopping", name: "Shopping" },
      ],
    });

    expect(plan.expectedIncome).toBe("100000.00");
    // Essentials = 25000 + 15000 = 40000
    // Goals = 20000 (Savings) + 10000 (Investment) = 30000
    // Discretionary = 10000 (Shopping)
    // Total allocated = 80000, unallocated = 20000
    expect(plan.savingsTarget).toBe("30000.00");
    expect(plan.totalAllocated).toBe("80000.00");
    expect(plan.unallocated).toBe("20000.00");
    expect(plan.rationale).toContain("Expected monthly income in KES is 100000.00");
    expect(plan.rationale).toContain("Essential living expenses (transport, health, utilities) receive 40000.00 KES");
    expect(plan.rationale).toContain("Savings and investment goals receive 30000.00 KES");
  });

  it("omits rent, food, education, and family and matches the user proportional budget allocation", () => {
    const plan = generateGoalBasedBudget({
      currency: "KES",
      incomeSources: [
        {
          amount: "27200.00",
          currency: "KES",
          frequency: "MONTHLY",
          isActive: true,
        },
      ],
      historicalSpending: [],
      goals: [],
      categories: [
        { id: "c1", name: "Rent" },
        { id: "c2", name: "Food" },
        { id: "c3", name: "Education" },
        { id: "c4", name: "Family" },
        { id: "c5", name: "Transport" },
        { id: "c6", name: "Savings" },
        { id: "c7", name: "Health" },
        { id: "c8", name: "Shopping" },
        { id: "c9", name: "Utilities" },
        { id: "c10", name: "Other" },
        { id: "c11", name: "Giving" },
        { id: "c12", name: "Entertainment" },
      ],
    });

    const catMap = new Map(plan.categories.map((c) => [c.categoryName.toLowerCase(), c.allocated]));

    // Excluded categories must not be in the generated plan
    expect(catMap.has("rent")).toBe(false);
    expect(catMap.has("food")).toBe(false);
    expect(catMap.has("education")).toBe(false);
    expect(catMap.has("family")).toBe(false);

    // Exact requested amounts on 27,200 KES base:
    expect(catMap.get("transport")).toBe("10000.00");
    expect(catMap.get("savings")).toBe("4000.00");
    expect(catMap.get("health")).toBe("2000.00");
    expect(catMap.get("shopping")).toBe("2000.00");
    expect(catMap.get("utilities")).toBe("1500.00");
    expect(catMap.get("other")).toBe("5000.00");
    expect(catMap.get("giving")).toBe("1200.00");
    expect(catMap.get("entertainment")).toBe("1500.00");

    expect(plan.totalAllocated).toBe("27200.00");
    expect(plan.unallocated).toBe("0.00");
  });

  it("omits rent and food categories and generates sensible, clean amounts without irregular divisions", () => {
    const plan = generateGoalBasedBudget({
      currency: "KES",
      incomeSources: [
        {
          amount: "50000.00",
          currency: "KES",
          frequency: "MONTHLY",
          isActive: true,
        },
      ],
      historicalSpending: [],
      goals: [],
      categories: [
        { id: "c1", name: "Rent" },
        { id: "c2", name: "Food" },
        { id: "c3", name: "Utilities" },
        { id: "c4", name: "Transport" },
        { id: "c5", name: "Health" },
        { id: "c6", name: "Savings" },
        { id: "c7", name: "Shopping" },
        { id: "c8", name: "Entertainment" },
      ],
    });

    // Rent and Food must be omitted
    const catNames = plan.categories.map((c) => c.categoryName.toLowerCase());
    expect(catNames).not.toContain("rent");
    expect(catNames).not.toContain("food");

    // Transport receives 36.8% of 50,000 = 18,400
    const transportItem = plan.categories.find((c) => c.categoryName.toLowerCase() === "transport");
    expect(transportItem?.allocated).toBe("18400.00");

    // All allocated amounts must be clean round numbers (multiples of 50 or 100)
    for (const item of plan.categories) {
      const num = Number(item.allocated);
      expect(num % 50).toBe(0);
      expect(num).toBeGreaterThan(0);
    }

    // Must not exceed total income
    expect(Number(plan.totalAllocated)).toBeLessThanOrEqual(50000);
    expect(Number(plan.unallocated)).toBeGreaterThanOrEqual(0);
  });

  it("compares budget allocations against actual spending and flags over-budget categories", () => {
    const vsActual = computeBudgetVsActual(
      {
        id: "bud_1",
        year: 2026,
        month: 10,
        currency: "KES",
        expectedIncome: "100000.00",
        totalAllocated: "45000.00",
        savingsTarget: "15000.00",
        rationale: "Test rationale",
        categories: [
          {
            categoryId: "cat_rent",
            categoryName: "Rent",
            allocated: "30000.00",
            isEssential: true,
          },
          {
            categoryId: "cat_food",
            categoryName: "Food",
            allocated: "15000.00",
            isEssential: true,
          },
        ],
      },
      {
        cat_rent: "30000.00",
        cat_food: "18000.00",
      }
    );

    expect(vsActual.totalActualSpending).toBe("48000.00");
    expect(vsActual.totalRemaining).toBe("-3000.00");
    const foodRow = vsActual.categories.find((c) => c.categoryId === "cat_food");
    expect(foodRow?.isOverBudget).toBe(true);
    expect(foodRow?.percentUsed).toBe("120.00");
  });
});

