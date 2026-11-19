import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractMerchantKeyword,
  recordCategoryRule,
  suggestCategoryForUser,
} from "@/services/ai/categorization";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    categoryCorrectionRule: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    goal: {
      findMany: vi.fn(),
    },
    budget: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/services/category/category", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: "cat_util", name: "Utilities", isDefault: true, userId: null },
    { id: "cat_trans", name: "Transportation", isDefault: true, userId: null },
    { id: "cat_food", name: "Food & Dining", isDefault: true, userId: null },
  ]),
}));

describe("AI Categorization Service: services/ai/categorization.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractMerchantKeyword", () => {
    it("extracts concise normalized merchant keyword from transaction descriptions", () => {
      expect(extractMerchantKeyword("Total Energies Petrol Station")).toBe("total energies");
      expect(extractMerchantKeyword("Carrefour Two Rivers Supermarket")).toBe("carrefour two");
      expect(extractMerchantKeyword("KPLC Prepaid Token 49302")).toBe("kplc prepaid");
      expect(extractMerchantKeyword("Uber *Trip 98382")).toBe("uber trip");
    });
  });

  describe("recordCategoryRule", () => {
    it("upserts a user category habit rule in database for future 0-token matching", async () => {
      await recordCategoryRule("user_123", "Shell Rongai Fuel", "cat_trans");

      expect(prisma.categoryCorrectionRule.upsert).toHaveBeenCalledWith({
        where: {
          userId_keyword: {
            userId: "user_123",
            keyword: "shell rongai",
          },
        },
        update: {
          categoryId: "cat_trans",
        },
        create: {
          userId: "user_123",
          keyword: "shell rongai",
          categoryId: "cat_trans",
        },
      });
    });

    it("ignores single-character or empty descriptions safely", async () => {
      await recordCategoryRule("user_123", " ", "cat_trans");
      expect(prisma.categoryCorrectionRule.upsert).not.toHaveBeenCalled();
    });
  });

  describe("suggestCategoryForUser", () => {
    it("matches Kenyan merchant keywords instantly with local rules", async () => {
      (prisma.categoryCorrectionRule.findMany as any).mockResolvedValueOnce([]);
      (prisma.goal.findMany as any).mockResolvedValueOnce([]);

      const result = await suggestCategoryForUser("user_123", {
        description: "KPLC Prepaid Token",
        amount: "1500.00",
        currency: "KES",
      });

      expect(result).not.toBeNull();
      expect(result?.categoryId).toBe("cat_util");
      expect(result?.categoryName).toBe("Utilities");
      expect(result?.isFromLocalMemory).toBe(true);
    });
  });
});
