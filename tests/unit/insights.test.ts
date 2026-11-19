import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listStoredMonthlyInsights,
  dismissInsight,
  generateAndSaveMonthlyInsights,
} from "@/services/ai/insights";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aIInsight: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock("@/services/dashboard/summary", () => ({
  getDashboardSummary: vi.fn().mockResolvedValue({
    byCurrency: {
      KES: {
        income: "120000.00",
        spending: "80000.00",
        saved: "25000.00",
        invested: "15000.00",
        netCashFlow: "40000.00",
        spendingByCategory: [{ categoryName: "Transport", amount: "15000.00" }],
      },
    },
  }),
}));

vi.mock("@/services/budget/budget", () => ({
  getBudgetWithActuals: vi.fn().mockResolvedValue({
    totalAllocated: "75000.00",
    totalActualSpending: "80000.00",
    categories: [
      {
        categoryName: "Transport",
        allocated: "10000.00",
        actualSpend: "15000.00",
        isOverBudget: true,
      },
    ],
  }),
}));

vi.mock("@/services/goal/goal", () => ({
  listGoalsWithProgress: vi.fn().mockResolvedValue([
    {
      name: "Emergency Fund",
      currency: "KES",
      currentAmount: "50000.00",
      targetAmount: "100000.00",
      percentComplete: "50",
      status: "ON_TRACK",
    },
  ]),
}));

vi.mock("@/lib/ai/memory", () => ({
  buildUserFinancialMemory: vi.fn().mockResolvedValue({
    merchantHabits: {},
    primaryCurrency: "KES",
  }),
}));

vi.mock("@/lib/ai/gemini", () => ({
  generateInsightsWithMemory: vi.fn().mockResolvedValue([
    {
      type: "CASH_FLOW_TREND",
      title: "Strong Monthly Surplus",
      summary: "You maintained a 40,000 KES cash surplus this month.",
      actionableStep: "Direct this surplus to your Emergency Fund.",
      reasoning: { netCashFlow: "40000.00" },
    },
    {
      type: "SPENDING_ALERT",
      title: "Transport Over Budget",
      summary: "Transport reached 15,000 KES against the 10,000 KES target.",
      actionableStep: "Cap flexible ride spending for the next two weeks.",
      reasoning: { category: "Transport", allocated: "10000.00", actual: "15000.00" },
    },
  ]),
}));

describe("Monthly Insights Service: services/ai/insights.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listStoredMonthlyInsights fetches non-dismissed insights for the specified period and currency", async () => {
    const mockList = [
      {
        id: "ins_1",
        userId: "user_1",
        year: 2026,
        month: 11,
        currency: "KES",
        type: "CASH_FLOW_TREND",
        title: "Strong Surplus",
        summary: "Summary text",
        actionableStep: "Action",
        reasoning: {},
        isDismissed: false,
        createdAt: new Date(),
      },
    ];
    (prisma.aIInsight.findMany as any).mockResolvedValueOnce(mockList);

    const result = await listStoredMonthlyInsights("user_1", {
      year: 2026,
      month: 11,
      currency: "KES",
    });

    expect(prisma.aIInsight.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        year: 2026,
        month: 11,
        currency: "KES",
        isDismissed: false,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual(mockList);
  });

  it("dismissInsight sets isDismissed to true for the specified insight and user", async () => {
    (prisma.aIInsight.updateMany as any).mockResolvedValueOnce({ count: 1 });

    const success = await dismissInsight("user_1", "ins_1");

    expect(prisma.aIInsight.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ins_1",
        userId: "user_1",
      },
      data: {
        isDismissed: true,
      },
    });
    expect(success).toBe(true);
  });

  it("generateAndSaveMonthlyInsights gathers verified numbers, generates insights, and persists to database", async () => {
    (prisma.aIInsight.findMany as any).mockResolvedValueOnce([
      {
        id: "ins_new_1",
        title: "Strong Monthly Surplus",
      },
      {
        id: "ins_new_2",
        title: "Transport Over Budget",
      },
    ]);

    const result = await generateAndSaveMonthlyInsights("user_1", {
      year: 2026,
      month: 11,
      currency: "KES",
    });

    expect(prisma.aIInsight.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        year: 2026,
        month: 11,
        currency: "KES",
      },
    });
    expect(prisma.aIInsight.createMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
  });
});
