import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCategoryFindMany,
  mockCategoryFindFirst,
  mockCategoryFindUnique,
  mockCategoryCreate,
  mockCategoryUpdate,
  mockCategoryDelete,
  mockTransactionUpdateMany,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockCategoryFindMany: vi.fn(),
  mockCategoryFindFirst: vi.fn(),
  mockCategoryFindUnique: vi.fn(),
  mockCategoryCreate: vi.fn(),
  mockCategoryUpdate: vi.fn(),
  mockCategoryDelete: vi.fn(),
  mockTransactionUpdateMany: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    category: {
      findMany: mockCategoryFindMany,
      findFirst: mockCategoryFindFirst,
      findUnique: mockCategoryFindUnique,
      create: mockCategoryCreate,
      update: mockCategoryUpdate,
      delete: mockCategoryDelete,
    },
    transaction: {
      updateMany: mockTransactionUpdateMany,
    },
    $transaction: mockPrismaTransaction,
  },
}));

import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
  CategoryAlreadyExistsError,
  CategoryNotFoundError,
  DefaultCategoryImmutableError,
} from "@/services/category/category";

describe("Category service", () => {
  beforeEach(() => {
    mockCategoryFindMany.mockReset();
    mockCategoryFindFirst.mockReset();
    mockCategoryFindUnique.mockReset();
    mockCategoryCreate.mockReset();
    mockCategoryUpdate.mockReset();
    mockCategoryDelete.mockReset();
    mockTransactionUpdateMany.mockReset();
    mockPrismaTransaction.mockReset();
  });

  it("listCategories merges shared defaults and user custom categories sorted by name", async () => {
    const mockedList = [
      { id: "c1", name: "Coffee", userId: "user_1", isDefault: false, icon: "☕" },
      { id: "c2", name: "Food", userId: null, isDefault: true, icon: null },
    ];
    mockCategoryFindMany.mockResolvedValueOnce(mockedList);

    const result = await listCategories("user_1");

    expect(mockCategoryFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ isDefault: true, userId: null }, { userId: "user_1" }],
      },
      orderBy: { name: "asc" },
    });
    expect(result).toEqual(mockedList);
  });

  it("createCategory creates a custom category when name is unique", async () => {
    mockCategoryFindFirst.mockResolvedValueOnce(null);
    mockCategoryCreate.mockResolvedValueOnce({
      id: "cat_custom",
      userId: "user_1",
      name: "Pet Care",
      icon: "🐾",
      isDefault: false,
    });

    const created = await createCategory("user_1", { name: "Pet Care", icon: "🐾" });

    expect(mockCategoryFindFirst).toHaveBeenCalledWith({
      where: {
        name: { equals: "Pet Care", mode: "insensitive" },
        OR: [{ isDefault: true, userId: null }, { userId: "user_1" }],
      },
      select: { id: true },
    });
    expect(created.isDefault).toBe(false);
  });

  it("createCategory rejects duplicate name (including case-insensitive default match)", async () => {
    mockCategoryFindFirst.mockResolvedValueOnce({ id: "cat_default_food" });

    await expect(
      createCategory("user_1", { name: "food" })
    ).rejects.toThrow(CategoryAlreadyExistsError);
  });

  it("renameCategory rejects default categories with DefaultCategoryImmutableError", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce({
      id: "cat_default",
      userId: null,
      isDefault: true,
    });

    await expect(
      renameCategory("user_1", "cat_default", "Groceries")
    ).rejects.toThrow(DefaultCategoryImmutableError);
  });

  it("renameCategory and deleteCategory reject missing or another user's category with CategoryNotFoundError", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce(null);
    await expect(
      renameCategory("user_1", "cat_missing", "New Name")
    ).rejects.toThrow(CategoryNotFoundError);

    mockCategoryFindUnique.mockResolvedValueOnce({
      id: "cat_other",
      userId: "user_other",
      isDefault: false,
    });
    await expect(
      renameCategory("user_1", "cat_other", "New Name")
    ).rejects.toThrow(CategoryNotFoundError);

    mockCategoryFindUnique.mockResolvedValueOnce({
      id: "cat_other",
      userId: "user_other",
      isDefault: false,
    });
    await expect(deleteCategory("user_1", "cat_other")).rejects.toThrow(
      CategoryNotFoundError
    );
  });

  it("deleteCategory rejects default categories and nulls categoryId on transactions when deleting custom category", async () => {
    mockCategoryFindUnique.mockResolvedValueOnce({
      id: "cat_default",
      userId: null,
      isDefault: true,
    });

    await expect(deleteCategory("user_1", "cat_default")).rejects.toThrow(
      DefaultCategoryImmutableError
    );

    mockCategoryFindUnique.mockResolvedValueOnce({
      id: "cat_custom",
      userId: "user_1",
      isDefault: false,
    });
    mockTransactionUpdateMany.mockResolvedValueOnce({ count: 3 });
    mockCategoryDelete.mockResolvedValueOnce({ id: "cat_custom" });
    mockPrismaTransaction.mockResolvedValueOnce([{ count: 3 }, { id: "cat_custom" }]);

    await deleteCategory("user_1", "cat_custom");

    expect(mockTransactionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", categoryId: "cat_custom" },
      data: { categoryId: null },
    });
    expect(mockCategoryDelete).toHaveBeenCalledWith({
      where: { id: "cat_custom" },
    });
    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
  });
});

