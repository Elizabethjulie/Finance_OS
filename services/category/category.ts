import { prisma } from "@/lib/db/prisma";
import { createCategorySchema, type CreateCategoryInput } from "@/lib/validation/transactions";

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Category not found.");
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryAlreadyExistsError extends Error {
  constructor() {
    super("A category with this name already exists.");
    this.name = "CategoryAlreadyExistsError";
  }
}

export class DefaultCategoryImmutableError extends Error {
  constructor() {
    super("Default categories cannot be modified or deleted.");
    this.name = "DefaultCategoryImmutableError";
  }
}

export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: {
      OR: [{ isDefault: true, userId: null }, { userId }],
    },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(userId: string, input: CreateCategoryInput) {
  const data = createCategorySchema.parse(input);

  const existing = await prisma.category.findFirst({
    where: {
      name: { equals: data.name, mode: "insensitive" },
      OR: [{ isDefault: true, userId: null }, { userId }],
    },
    select: { id: true },
  });

  if (existing) {
    throw new CategoryAlreadyExistsError();
  }

  return prisma.category.create({
    data: {
      userId,
      name: data.name,
      icon: data.icon || null,
      isDefault: false,
    },
  });
}

export async function renameCategory(
  userId: string,
  categoryId: string,
  name: string
) {
  const parsed = createCategorySchema.pick({ name: true }).parse({ name });

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, userId: true, isDefault: true },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }
  if (category.isDefault) {
    throw new DefaultCategoryImmutableError();
  }
  if (category.userId !== userId) {
    throw new CategoryNotFoundError();
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      id: { not: categoryId },
      name: { equals: parsed.name, mode: "insensitive" },
      OR: [{ isDefault: true, userId: null }, { userId }],
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new CategoryAlreadyExistsError();
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: { name: parsed.name },
  });
}

export async function deleteCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, userId: true, isDefault: true },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }
  if (category.isDefault) {
    throw new DefaultCategoryImmutableError();
  }
  if (category.userId !== userId) {
    throw new CategoryNotFoundError();
  }

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { userId, categoryId },
      data: { categoryId: null },
    }),
    prisma.category.delete({
      where: { id: categoryId },
    }),
  ]);
}

