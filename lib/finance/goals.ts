import Decimal from "decimal.js";
import type { Currency, GoalType } from "@/lib/generated/prisma/client";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import { formatAmount, toDecimal } from "@/lib/finance/money";

export type GoalInputRow = {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: string;
  startingAmount: string;
  currency: Currency;
  targetDate: Date;
  createdAt: Date;
};

export type GoalContributionRow = {
  goalId: string;
  amount: string;
  currency: Currency;
  contributedAt: Date;
};

export type GoalStatus = "COMPLETED" | "OVERDUE" | "AHEAD" | "ON_TRACK" | "BEHIND";

export type ComputedGoalProgress = {
  goalId: string;
  name: string;
  type: GoalType;
  currency: Currency;
  targetAmount: string;
  startingAmount: string;
  contributedAmount: string;
  currentAmount: string;
  remainingAmount: string;
  percentComplete: string;
  monthsRemaining: number;
  isPastDeadline: boolean;
  requiredMonthlyContribution: string;
  status: GoalStatus;
  targetDate: string;
  assumptions: string[];
};

function getYearMonthInNairobi(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? date.getUTCFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? date.getUTCMonth() + 1);
  return { year, month };
}

/**
 * Computes full deterministic progress, required monthly contribution, status,
 * and explicit financial assumptions for a single Goal.
 */
export function computeGoalProgress(
  goal: GoalInputRow,
  contributions: GoalContributionRow[],
  asOfDate: Date = new Date(),
  hasIrregularIncome = false
): ComputedGoalProgress {
  const target = toDecimal(goal.targetAmount);
  const starting = toDecimal(goal.startingAmount);

  let contributed = new Decimal(0);
  for (const row of contributions) {
    if (row.goalId !== goal.id) continue;
    if (row.currency !== goal.currency) {
      throw new CurrencyMismatchError(
        `Contribution currency (${row.currency}) must match goal currency (${goal.currency})`
      );
    }
    contributed = contributed.plus(toDecimal(row.amount));
  }

  const current = starting.plus(contributed);
  const remaining = Decimal.max(new Decimal(0), target.minus(current));

  const rawPercent = target.gt(0)
    ? current.div(target).mul(100)
    : new Decimal(100);
  const clampedPercent = Decimal.min(new Decimal(100), Decimal.max(new Decimal(0), rawPercent));

  const nowYM = getYearMonthInNairobi(asOfDate);
  const targetYM = getYearMonthInNairobi(goal.targetDate);
  const rawMonthsDiff =
    (targetYM.year - nowYM.year) * 12 + (targetYM.month - nowYM.month);
  const monthsRemaining = Math.max(0, rawMonthsDiff);

  const isCompleted = current.gte(target);
  const isPastDeadline = !isCompleted && asOfDate.getTime() > goal.targetDate.getTime();

  let requiredMonthly = new Decimal(0);
  if (!isCompleted) {
    if (monthsRemaining <= 0) {
      // Past deadline or due within the current month: full remaining amount is required now
      requiredMonthly = remaining;
    } else {
      requiredMonthly = remaining.div(monthsRemaining);
    }
  }

  let status: GoalStatus;
  if (isCompleted) {
    status = "COMPLETED";
  } else if (isPastDeadline) {
    status = "OVERDUE";
  } else {
    const createdMs = goal.createdAt.getTime();
    const targetMs = goal.targetDate.getTime();
    const asOfMs = asOfDate.getTime();
    const totalSpanMs = targetMs - createdMs;

    if (totalSpanMs <= 0 || asOfMs <= createdMs) {
      status = current.gt(0) ? "AHEAD" : "ON_TRACK";
    } else {
      const elapsedRatio = new Decimal(
        Math.min(1, Math.max(0, (asOfMs - createdMs) / totalSpanMs))
      );
      const actualRatio = target.gt(0) ? current.div(target) : new Decimal(1);
      const tolerance = new Decimal("0.05");

      if (actualRatio.gte(elapsedRatio.plus(tolerance))) {
        status = "AHEAD";
      } else if (actualRatio.plus(tolerance).lt(elapsedRatio)) {
        status = "BEHIND";
      } else {
        status = "ON_TRACK";
      }
    }
  }

  const assumptions: string[] = [
    monthsRemaining > 0
      ? `Assumes ${monthsRemaining} equal monthly contribution(s) of ${formatAmount(requiredMonthly)} ${goal.currency} until ${goal.targetDate.toISOString().slice(0, 10)}.`
      : isCompleted
      ? "Goal target has been reached."
      : `Target date (${goal.targetDate.toISOString().slice(0, 10)}) is due or past; full remaining balance of ${formatAmount(remaining)} ${goal.currency} is required immediately.`,
  ];

  if (hasIrregularIncome) {
    assumptions.push(
      "Irregular income detected: contribute higher amounts during peak-income months to stay ahead of the baseline monthly target."
    );
  }

  return {
    goalId: goal.id,
    name: goal.name,
    type: goal.type,
    currency: goal.currency,
    targetAmount: formatAmount(target),
    startingAmount: formatAmount(starting),
    contributedAmount: formatAmount(contributed),
    currentAmount: formatAmount(current),
    remainingAmount: formatAmount(remaining),
    percentComplete: formatAmount(clampedPercent),
    monthsRemaining,
    isPastDeadline,
    requiredMonthlyContribution: formatAmount(requiredMonthly),
    status,
    targetDate: goal.targetDate.toISOString(),
    assumptions,
  };
}
