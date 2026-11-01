import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyMismatchError } from "@/lib/finance/balance";
import { computeGoalProgress } from "@/lib/finance/goals";

const {
  mockGoalFindMany,
  mockGoalFindFirst,
  mockGoalCreate,
  mockGoalUpdate,
  mockContribFindMany,
  mockContribCreate,
  mockIncomeSourceCount,
  mockTxFindFirst,
} = vi.hoisted(() => ({
  mockGoalFindMany: vi.fn(),
  mockGoalFindFirst: vi.fn(),
  mockGoalCreate: vi.fn(),
  mockGoalUpdate: vi.fn(),
  mockContribFindMany: vi.fn(),
  mockContribCreate: vi.fn(),
  mockIncomeSourceCount: vi.fn(),
  mockTxFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    goal: {
      findMany: mockGoalFindMany,
      findFirst: mockGoalFindFirst,
      create: mockGoalCreate,
      update: mockGoalUpdate,
    },
    goalContribution: {
      findMany: mockContribFindMany,
      create: mockContribCreate,
    },
    incomeSource: {
      count: mockIncomeSourceCount,
    },
    transaction: {
      findFirst: mockTxFindFirst,
    },
  },
}));

import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  GoalNotFoundError,
  listGoalsWithProgress,
} from "@/services/goal/goal";

describe("Phase 5: Goal progress pure calculations (lib/finance/goals.ts)", () => {
  it("computes required monthly contribution = (target - current) / monthsRemaining", () => {
    const progress = computeGoalProgress(
      {
        id: "g_1",
        name: "Emergency Fund",
        type: "EMERGENCY_FUND",
        targetAmount: "120000.00",
        startingAmount: "20000.00",
        currency: "KES",
        targetDate: new Date("2027-04-15T00:00:00Z"),
        createdAt: new Date("2026-10-01T00:00:00Z"),
      },
      [
        {
          goalId: "g_1",
          amount: "10000.00",
          currency: "KES",
          contributedAt: new Date("2026-10-10T00:00:00Z"),
        },
      ],
      new Date("2026-10-15T00:00:00Z"),
      true
    );

    // Current = 20000 + 10000 = 30000; Remaining = 90000; Months from Oct 2026 to Apr 2027 = 6
    expect(progress.currentAmount).toBe("30000.00");
    expect(progress.remainingAmount).toBe("90000.00");
    expect(progress.monthsRemaining).toBe(6);
    expect(progress.requiredMonthlyContribution).toBe("15000.00");
    expect(progress.percentComplete).toBe("25.00");
    expect(progress.status).toBe("AHEAD");
    expect(progress.assumptions.some((a) => a.includes("Irregular income"))).toBe(true);
  });

  it("handles past deadlines (OVERDUE) and requires full remaining amount immediately", () => {
    const progress = computeGoalProgress(
      {
        id: "g_overdue",
        name: "Laptop Upgrade",
        type: "SAVINGS",
        targetAmount: "1000.00",
        startingAmount: "250.00",
        currency: "USD",
        targetDate: new Date("2026-08-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      [],
      new Date("2026-10-15T00:00:00Z")
    );

    expect(progress.isPastDeadline).toBe(true);
    expect(progress.monthsRemaining).toBe(0);
    expect(progress.requiredMonthlyContribution).toBe("750.00");
    expect(progress.status).toBe("OVERDUE");
  });

  it("marks goal as COMPLETED with 0.00 required monthly contribution when target is met", () => {
    const progress = computeGoalProgress(
      {
        id: "g_done",
        name: "Holiday Fund",
        type: "SAVINGS",
        targetAmount: "500.00",
        startingAmount: "300.00",
        currency: "EUR",
        targetDate: new Date("2026-12-01T00:00:00Z"),
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
      [
        {
          goalId: "g_done",
          amount: "250.00",
          currency: "EUR",
          contributedAt: new Date("2026-09-01T00:00:00Z"),
        },
      ],
      new Date("2026-10-01T00:00:00Z")
    );

    expect(progress.status).toBe("COMPLETED");
    expect(progress.remainingAmount).toBe("0.00");
    expect(progress.requiredMonthlyContribution).toBe("0.00");
    expect(progress.percentComplete).toBe("100.00");
  });

  it("throws CurrencyMismatchError if a contribution has a different currency", () => {
    expect(() =>
      computeGoalProgress(
        {
          id: "g_1",
          name: "Fund",
          type: "SAVINGS",
          targetAmount: "1000.00",
          startingAmount: "0.00",
          currency: "KES",
          targetDate: new Date("2027-01-01T00:00:00Z"),
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
        [
          {
            goalId: "g_1",
            amount: "100.00",
            currency: "USD",
            contributedAt: new Date("2026-10-05T00:00:00Z"),
          },
        ]
      )
    ).toThrow(CurrencyMismatchError);
  });
});

describe("Phase 5: Goal service (services/goal/goal.ts)", () => {
  beforeEach(() => {
    mockGoalFindMany.mockReset();
    mockGoalFindFirst.mockReset();
    mockGoalCreate.mockReset();
    mockGoalUpdate.mockReset();
    mockContribFindMany.mockReset();
    mockContribCreate.mockReset();
    mockIncomeSourceCount.mockReset();
    mockTxFindFirst.mockReset();
  });

  it("creates a goal and returns its computed progress", async () => {
    mockGoalCreate.mockResolvedValueOnce({
      id: "goal_new",
      userId: "user_1",
      name: "Emergency Reserve",
      type: "EMERGENCY_FUND",
      targetAmount: "60000.00",
      startingAmount: "10000.00",
      currency: "KES",
      targetDate: new Date("2027-03-01T00:00:00Z"),
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    mockIncomeSourceCount.mockResolvedValueOnce(0);

    const res = await createGoal("user_1", {
      name: "Emergency Reserve",
      type: "EMERGENCY_FUND",
      targetAmount: "60000.00",
      startingAmount: "10000.00",
      currency: "KES",
      targetDate: new Date("2027-03-01T00:00:00Z"),
    });

    expect(res.goalId).toBe("goal_new");
    expect(res.currentAmount).toBe("10000.00");
    expect(res.remainingAmount).toBe("50000.00");
  });

  it("rejects contributions to another user's goal with GoalNotFoundError", async () => {
    mockGoalFindFirst.mockResolvedValueOnce(null);

    await expect(
      addGoalContribution("user_1", {
        goalId: "other_users_goal",
        amount: "500.00",
        currency: "KES",
      })
    ).rejects.toThrow(GoalNotFoundError);
  });

  it("rejects archiving another user's goal with GoalNotFoundError", async () => {
    mockGoalFindFirst.mockResolvedValueOnce(null);

    await expect(archiveGoal("user_1", "other_users_goal")).rejects.toThrow(
      GoalNotFoundError
    );
  });

  it("lists goals with progress scoped to userId", async () => {
    mockGoalFindMany.mockResolvedValueOnce([
      {
        id: "g_1",
        userId: "user_1",
        name: "Emergency Fund",
        type: "EMERGENCY_FUND",
        targetAmount: "100000.00",
        startingAmount: "25000.00",
        currency: "KES",
        targetDate: new Date("2027-01-15T00:00:00Z"),
        createdAt: new Date("2026-10-01T00:00:00Z"),
      },
    ]);
    mockContribFindMany.mockResolvedValueOnce([
      {
        goalId: "g_1",
        amount: "25000.00",
        currency: "KES",
        contributedAt: new Date("2026-10-10T00:00:00Z"),
      },
    ]);
    mockIncomeSourceCount.mockResolvedValueOnce(1);

    const list = await listGoalsWithProgress("user_1", new Date("2026-10-15T00:00:00Z"));
    expect(list).toHaveLength(1);
    expect(list[0].currentAmount).toBe("50000.00");
    expect(list[0].percentComplete).toBe("50.00");
  });
});

