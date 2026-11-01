import Decimal from "decimal.js";
import type { Currency, Frequency, GoalType } from "@/lib/generated/prisma/client";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export type BudgetIncomeSourceRow = {
  amount: string;
  currency: Currency;
  frequency: Frequency;
  isActive: boolean;
};

export type HistoricalCategorySpendRow = {
  categoryId: string;
  categoryName: string;
  averageMonthlySpend: string;
};

export type BudgetGoalNeedRow = {
  goalId: string;
  name: string;
  type: GoalType;
  requiredMonthlyContribution: string;
};

export type AvailableCategoryRow = {
  id: string;
  name: string;
};

export type GeneratedBudgetCategoryItem = {
  categoryId: string;
  categoryName: string;
  allocated: string;
  isEssential: boolean;
  note: string;
};

export type GeneratedBudgetPlan = {
  currency: Currency;
  expectedIncome: string;
  totalAllocated: string;
  savingsTarget: string;
  unallocated: string;
  rationale: string;
  categories: GeneratedBudgetCategoryItem[];
};

/**
 * Categories excluded from automated generation per user request.
 * See docs/budget-planner-future-review.md for planned future re-inclusion
 * and user-configurable lifestyle profile architecture.
 */
const EXCLUDED_CATEGORY_NAMES = new Set([
  "rent",
  "food",
  "housing",
  "dining",
  "groceries",
  "education",
  "family",
]);

const ESSENTIAL_CATEGORY_NAMES = new Set([
  "transport",
  "health",
  "utilities",
]);

const ESSENTIAL_DEFAULT_WEIGHTS: Record<string, number> = {
  transport: 0.368, // 36.8% (10,000 on 27,200 base)
  health: 0.074,    // 7.4% (2,000 on 27,200 base)
  utilities: 0.055, // 5.5% (1,500 on 27,200 base)
};

const DISCRETIONARY_DEFAULT_WEIGHTS: Record<string, number> = {
  other: 0.184,         // 18.4% (5,000 on 27,200 base)
  shopping: 0.074,      // 7.4% (2,000 on 27,200 base)
  entertainment: 0.055, // 5.5% (1,500 on 27,200 base)
  giving: 0.044,        // 4.4% (1,200 on 27,200 base)
};

/**
 * Rounds an amount to clean, human-friendly steps to avoid irregular fractional numbers.
 * In KES: rounds to nearest 100 (or 50 if < 500).
 * In EUR/USD/GBP: rounds to nearest 5 (or 1 if < 20).
 */
export function roundToSensibleStep(amount: Decimal, currency: Currency): Decimal {
  if (amount.isZero() || amount.isNegative()) return new Decimal(0);

  if (currency === "KES") {
    if (amount.lt(500)) {
      return amount.div(50).round().mul(50);
    }
    return amount.div(100).round().mul(100);
  } else {
    if (amount.lt(20)) {
      return amount.round();
    }
    return amount.div(5).round().mul(5);
  }
}

/**
 * Normalizes a single income source row into its monthly equivalent in Decimal.
 * Irregular income is discounted by a 20% safety factor (0.80x) so the budget
 * never over-commits unpredictable earnings.
 */
export function normalizeMonthlyIncome(
  sources: BudgetIncomeSourceRow[],
  currency: Currency
): { monthlyIncome: Decimal; hasIrregularIncome: boolean } {
  let total = new Decimal(0);
  let hasIrregularIncome = false;

  for (const src of sources) {
    if (!src.isActive || src.currency !== currency) continue;
    const amt = toDecimal(src.amount);

    switch (src.frequency) {
      case "WEEEKLY":
        total = total.plus(amt.mul(52).div(12));
        break;
      case "BIWEEKLY":
        total = total.plus(amt.mul(26).div(12));
        break;
      case "MONTHLY":
        total = total.plus(amt);
        break;
      case "QUARTERLY":
        total = total.plus(amt.div(3));
        break;
      case "ANNUALLY":
        total = total.plus(amt.div(12));
        break;
      case "IRREGULAR":
        hasIrregularIncome = true;
        total = total.plus(amt.mul("0.80"));
        break;
    }
  }

  return { monthlyIncome: total, hasIrregularIncome };
}

/**
 * Deterministic goal-based monthly budget allocator (Phase 4).
 * Never uses a flat 50/30/20 rule; instead prioritizes:
 *   1. Essential living expenses (anchored to historical spend, capped at 70% of income if income > 0)
 *   2. Active goal & emergency fund monthly targets (allocated to Savings & Investment categories)
 *   3. Flexible/discretionary spending from remaining income based on historical weights
 */
export function generateGoalBasedBudget(input: {
  currency: Currency;
  incomeSources: BudgetIncomeSourceRow[];
  historicalSpending: HistoricalCategorySpendRow[];
  goals: BudgetGoalNeedRow[];
  categories: AvailableCategoryRow[];
}): GeneratedBudgetPlan {
  const { currency, incomeSources, historicalSpending, goals, categories } = input;
  const { monthlyIncome, hasIrregularIncome } = normalizeMonthlyIncome(
    incomeSources,
    currency
  );

  const histByCatId = new Map<string, Decimal>();
  for (const row of historicalSpending) {
    histByCatId.set(row.categoryId, toDecimal(row.averageMonthlySpend));
  }

  const savingsCategory = categories.find(
    (c) => c.name.trim().toLowerCase() === "savings"
  );
  const investmentCategory = categories.find(
    (c) => c.name.trim().toLowerCase() === "investment"
  );

  let requestedSavingsGoals = new Decimal(0);
  let requestedInvestmentGoals = new Decimal(0);
  for (const g of goals) {
    const req = toDecimal(g.requiredMonthlyContribution);
    if (req.lte(0)) continue;
    if (g.type === "INVESTMENT") {
      requestedInvestmentGoals = requestedInvestmentGoals.plus(req);
    } else {
      requestedSavingsGoals = requestedSavingsGoals.plus(req);
    }
  }

  // Classify categories into Essentials, Goal buckets (Savings/Investment), and Discretionary
  const essentialCats: AvailableCategoryRow[] = [];
  const discretionaryCats: AvailableCategoryRow[] = [];

  for (const cat of categories) {
    const lower = cat.name.trim().toLowerCase();
    // Exclude rent and food for now as requested
    if (EXCLUDED_CATEGORY_NAMES.has(lower)) {
      continue;
    }
    if (cat.id === savingsCategory?.id || cat.id === investmentCategory?.id) {
      continue;
    }
    if (ESSENTIAL_CATEGORY_NAMES.has(lower)) {
      essentialCats.push(cat);
    } else {
      discretionaryCats.push(cat);
    }
  }

  // Step 1: Compute essential allocations using historical spend or sensible baseline weights
  let rawEssentialsTotal = new Decimal(0);
  const rawEssentialsMap = new Map<string, Decimal>();
  for (const cat of essentialCats) {
    const hist = histByCatId.get(cat.id) ?? new Decimal(0);
    const lower = cat.name.trim().toLowerCase();
    let val = hist;
    if (val.isZero() && monthlyIncome.gt(0)) {
      const weight = ESSENTIAL_DEFAULT_WEIGHTS[lower] ?? 0.05;
      val = monthlyIncome.mul(weight);
    }
    rawEssentialsMap.set(cat.id, val);
    rawEssentialsTotal = rawEssentialsTotal.plus(val);
  }

  // Cap essentials to at most 60% of monthly income when income > 0
  const maxEssentialsCap = monthlyIncome.gt(0)
    ? monthlyIncome.mul("0.60")
    : rawEssentialsTotal;
  const essentialScale =
    rawEssentialsTotal.gt(maxEssentialsCap) && rawEssentialsTotal.gt(0)
      ? maxEssentialsCap.div(rawEssentialsTotal)
      : new Decimal(1);

  const allocatedItems: GeneratedBudgetCategoryItem[] = [];
  let totalEssentialsAllocated = new Decimal(0);

  for (const cat of essentialCats) {
    const raw = rawEssentialsMap.get(cat.id) ?? new Decimal(0);
    const scaled = raw.mul(essentialScale);
    const rounded = roundToSensibleStep(scaled, currency);
    if (rounded.gt(0)) {
      totalEssentialsAllocated = totalEssentialsAllocated.plus(rounded);
      allocatedItems.push({
        categoryId: cat.id,
        categoryName: cat.name,
        allocated: formatAmount(rounded),
        isEssential: true,
        note: histByCatId.has(cat.id) && (histByCatId.get(cat.id)?.gt(0))
          ? "Anchored to historical spending."
          : "Sensible living allocation tailored to typical baseline expenses.",
      });
    }
  }

  // Step 2: Allocate Goal & Emergency Fund requirements out of remaining income
  let remainingIncome = Decimal.max(
    new Decimal(0),
    monthlyIncome.minus(totalEssentialsAllocated)
  );

  const totalGoalNeed = requestedSavingsGoals.plus(requestedInvestmentGoals);
  // If no explicit goals exist yet and income remains, set a baseline savings fallback (~14.7%)
  const defaultSavingsFallback =
    totalGoalNeed.isZero() && remainingIncome.gt(0)
      ? Decimal.min(remainingIncome, monthlyIncome.mul("0.147"))
      : new Decimal(0);

  const desiredSavings = requestedSavingsGoals.plus(defaultSavingsFallback);
  const desiredInvestments = requestedInvestmentGoals;
  const desiredCombinedGoals = desiredSavings.plus(desiredInvestments);

  const goalScale =
    desiredCombinedGoals.gt(remainingIncome) && desiredCombinedGoals.gt(0)
      ? remainingIncome.div(desiredCombinedGoals)
      : new Decimal(1);

  const finalSavingsAllocated = roundToSensibleStep(desiredSavings.mul(goalScale), currency);
  const finalInvestmentAllocated = roundToSensibleStep(desiredInvestments.mul(goalScale), currency);

  if (savingsCategory && finalSavingsAllocated.gt(0)) {
    allocatedItems.push({
      categoryId: savingsCategory.id,
      categoryName: savingsCategory.name,
      allocated: formatAmount(finalSavingsAllocated),
      isEssential: true,
      note:
        requestedSavingsGoals.gt(0)
          ? "Allocated to meet active savings and emergency fund goal deadlines."
          : "Baseline emergency & savings reserve.",
    });
  }

  if (investmentCategory && finalInvestmentAllocated.gt(0)) {
    allocatedItems.push({
      categoryId: investmentCategory.id,
      categoryName: investmentCategory.name,
      allocated: formatAmount(finalInvestmentAllocated),
      isEssential: false,
      note: "Allocated for active investment goals.",
    });
  }

  const totalGoalAllocated = (savingsCategory ? finalSavingsAllocated : new Decimal(0)).plus(
    investmentCategory ? finalInvestmentAllocated : new Decimal(0)
  );

  remainingIncome = Decimal.max(
    new Decimal(0),
    remainingIncome.minus(totalGoalAllocated)
  );

  // Step 3: Allocate Discretionary categories from remaining income
  let rawDiscretionaryTotal = new Decimal(0);
  const rawDiscretionaryMap = new Map<string, Decimal>();
  for (const cat of discretionaryCats) {
    const hist = histByCatId.get(cat.id) ?? new Decimal(0);
    const lower = cat.name.trim().toLowerCase();
    let val = hist;
    if (val.isZero() && remainingIncome.gt(0)) {
      const weight = DISCRETIONARY_DEFAULT_WEIGHTS[lower] ?? 0.03;
      val = monthlyIncome.mul(weight);
    }
    rawDiscretionaryMap.set(cat.id, val);
    rawDiscretionaryTotal = rawDiscretionaryTotal.plus(val);
  }

  const discretionaryScale =
    rawDiscretionaryTotal.gt(remainingIncome) && rawDiscretionaryTotal.gt(0)
      ? remainingIncome.div(rawDiscretionaryTotal)
      : new Decimal(1);

  let totalDiscretionaryAllocated = new Decimal(0);
  for (const cat of discretionaryCats) {
    const raw = rawDiscretionaryMap.get(cat.id) ?? new Decimal(0);
    const scaled = raw.mul(discretionaryScale);
    const rounded = roundToSensibleStep(scaled, currency);
    if (rounded.gt(0)) {
      if (totalDiscretionaryAllocated.plus(rounded).gt(remainingIncome) && remainingIncome.gt(0)) {
        continue;
      }
      totalDiscretionaryAllocated = totalDiscretionaryAllocated.plus(rounded);
      allocatedItems.push({
        categoryId: cat.id,
        categoryName: cat.name,
        allocated: formatAmount(rounded),
        isEssential: false,
        note: "Flexible allocation after essentials and goal contributions.",
      });
    }
  }

  const totalAllocated = totalEssentialsAllocated
    .plus(totalGoalAllocated)
    .plus(totalDiscretionaryAllocated);
  const unallocated = Decimal.max(new Decimal(0), monthlyIncome.minus(totalAllocated));

  const rationaleParts: string[] = [
    `Expected monthly income in ${currency} is ${formatAmount(monthlyIncome)}${
      hasIrregularIncome ? " (includes a 20% safety buffer on irregular income)" : ""
    }.`,
    `Essential living expenses (transport, health, utilities) receive ${formatAmount(totalEssentialsAllocated)} ${currency}.`,
    `Savings and investment goals receive ${formatAmount(totalGoalAllocated)} ${currency}${
      totalGoalNeed.gt(0) ? " based on your active goal deadlines." : " as a baseline savings reserve."
    }`,
    `Flexible spending receives ${formatAmount(totalDiscretionaryAllocated)} ${currency}${
      unallocated.gt(0)
        ? `, leaving a sensible unallocated cushion of ${formatAmount(unallocated)} ${currency}.`
        : "."
    }`,
  ];

  return {
    currency,
    expectedIncome: formatAmount(monthlyIncome),
    totalAllocated: formatAmount(totalAllocated),
    savingsTarget: formatAmount(totalGoalAllocated),
    unallocated: formatAmount(unallocated),
    rationale: rationaleParts.join(" "),
    categories: allocatedItems,
  };
}

export type BudgetVsActualCategoryRow = {
  categoryId: string;
  categoryName: string;
  isEssential: boolean;
  allocated: string;
  actual: string;
  remaining: string;
  percentUsed: string;
  isOverBudget: boolean;
};

export type BudgetVsActualSummary = {
  budgetId: string;
  year: number;
  month: number;
  currency: Currency;
  expectedIncome: string;
  totalAllocated: string;
  totalActualSpending: string;
  totalRemaining: string;
  savingsTarget: string;
  rationale: string;
  categories: BudgetVsActualCategoryRow[];
};

/**
 * Pure comparison between a stored monthly Budget and actual net category spending
 * (EXPENSE minus REFUND) for that same month and currency.
 */
export function computeBudgetVsActual(
  budget: {
    id: string;
    year: number;
    month: number;
    currency: Currency;
    expectedIncome: string;
    totalAllocated: string;
    savingsTarget: string;
    rationale: string;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      allocated: string;
      isEssential: boolean;
    }>;
  },
  actualByCategoryId: Record<string, string>
): BudgetVsActualSummary {
  let totalActual = new Decimal(0);

  const categoryRows: BudgetVsActualCategoryRow[] = budget.categories.map((cat) => {
    const allocatedDec = toDecimal(cat.allocated);
    const actualDec = Decimal.max(
      new Decimal(0),
      toDecimal(actualByCategoryId[cat.categoryId] ?? "0")
    );
    totalActual = totalActual.plus(actualDec);

    const remainingDec = allocatedDec.minus(actualDec);
    const percentDec = allocatedDec.gt(0)
      ? actualDec.div(allocatedDec).mul(100)
      : actualDec.gt(0)
      ? new Decimal(100)
      : new Decimal(0);

    return {
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      isEssential: cat.isEssential,
      allocated: formatAmount(allocatedDec),
      actual: formatAmount(actualDec),
      remaining: formatAmount(remainingDec),
      percentUsed: formatAmount(percentDec),
      isOverBudget: actualDec.gt(allocatedDec),
    };
  });

  const totalAllocatedDec = toDecimal(budget.totalAllocated);
  const totalRemainingDec = totalAllocatedDec.minus(totalActual);

  return {
    budgetId: budget.id,
    year: budget.year,
    month: budget.month,
    currency: budget.currency,
    expectedIncome: formatAmount(toDecimal(budget.expectedIncome)),
    totalAllocated: formatAmount(totalAllocatedDec),
    totalActualSpending: formatAmount(totalActual),
    totalRemaining: formatAmount(totalRemainingDec),
    savingsTarget: formatAmount(toDecimal(budget.savingsTarget)),
    rationale: budget.rationale,
    categories: categoryRows,
  };
}

