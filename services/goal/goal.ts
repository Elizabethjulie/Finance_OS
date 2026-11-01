import { prisma } from "@/lib/db/prisma";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import {
  computeGoalProgress,
  type ComputedGoalProgress,
  type GoalContributionRow,
} from "@/lib/finance/goals";
import { formatAmount, toDecimal } from "@/lib/finance/money";
import {
  addGoalContributionSchema,
  createGoalSchema,
  type AddGoalContributionInput,
  type CreateGoalInput,
} from "@/lib/validation/goals";
import { TransactionNotFoundError } from "@/services/transaction/transaction";

export class GoalNotFoundError extends Error {
  constructor() {
    super("Goal not found");
    this.name = "GoalNotFoundError";
  }
}

export async function listGoalsWithProgress(
  userId: string,
  asOfDate: Date = new Date()
): Promise<ComputedGoalProgress[]> {
  const [goals, contributions, irregularSourcesCount] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, isArchived: false },
      orderBy: [{ targetDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.goalContribution.findMany({
      where: { userId },
      orderBy: { contributedAt: "asc" },
    }),
    prisma.incomeSource.count({
      where: { userId, isActive: true, frequency: "IRREGULAR" },
    }),
  ]);

  const hasIrregularIncome = irregularSourcesCount > 0;

  const contribRows: GoalContributionRow[] = contributions.map((c) => ({
    goalId: c.goalId,
    amount: String(c.amount),
    currency: c.currency,
    contributedAt: c.contributedAt,
  }));

  return goals.map((goal) =>
    computeGoalProgress(
      {
        id: goal.id,
        name: goal.name,
        type: goal.type,
        targetAmount: String(goal.targetAmount),
        startingAmount: String(goal.startingAmount ?? "0"),
        currency: goal.currency,
        targetDate: goal.targetDate,
        createdAt: goal.createdAt,
      },
      contribRows,
      asOfDate,
      hasIrregularIncome
    )
  );
}

export async function createGoal(
  userId: string,
  rawInput: CreateGoalInput
): Promise<ComputedGoalProgress> {
  const data = createGoalSchema.parse(rawInput);

  const created = await prisma.goal.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      targetAmount: data.targetAmount,
      startingAmount: data.startingAmount ?? "0",
      currency: data.currency,
      targetDate: data.targetDate,
    },
  });

  const irregularCount = await prisma.incomeSource.count({
    where: { userId, isActive: true, frequency: "IRREGULAR" },
  });

  return computeGoalProgress(
    {
      id: created.id,
      name: created.name,
      type: created.type,
      targetAmount: String(created.targetAmount),
      startingAmount: String(created.startingAmount ?? "0"),
      currency: created.currency,
      targetDate: created.targetDate,
      createdAt: created.createdAt,
    },
    [],
    new Date(),
    irregularCount > 0
  );
}

export async function addGoalContribution(
  userId: string,
  rawInput: AddGoalContributionInput
) {
  const data = addGoalContributionSchema.parse(rawInput);

  const goal = await prisma.goal.findFirst({
    where: { id: data.goalId, userId, isArchived: false },
  });
  if (!goal) {
    throw new GoalNotFoundError();
  }

  if (data.currency !== goal.currency) {
    throw new CurrencyMismatchError(
      `Contribution currency (${data.currency}) must match goal currency (${goal.currency})`
    );
  }

  if (data.transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: data.transactionId, userId, deletedAt: null },
    });
    if (!tx) {
      throw new TransactionNotFoundError();
    }
    if (tx.currency !== goal.currency) {
      throw new CurrencyMismatchError(
        `Transaction currency (${tx.currency}) must match goal currency (${goal.currency})`
      );
    }
  }

  const contribution = await prisma.goalContribution.create({
    data: {
      goalId: goal.id,
      userId,
      transactionId: data.transactionId ?? null,
      amount: data.amount,
      currency: data.currency,
      note: data.note ?? null,
      contributedAt: data.contributedAt ?? new Date(),
    },
  });

  return {
    id: contribution.id,
    goalId: contribution.goalId,
    transactionId: contribution.transactionId,
    amount: formatAmount(toDecimal(String(contribution.amount))),
    currency: contribution.currency,
    note: contribution.note,
    contributedAt: contribution.contributedAt.toISOString(),
  };
}

export async function archiveGoal(userId: string, goalId: string) {
  const existing = await prisma.goal.findFirst({
    where: { id: goalId, userId },
  });
  if (!existing) {
    throw new GoalNotFoundError();
  }

  return prisma.goal.update({
    where: { id: goalId },
    data: { isArchived: true },
  });
}
