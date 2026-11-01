import { z } from "zod";
import { Currency } from "@/lib/generated/prisma/client";

const nonNegativeAmountSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? "0" : v))
  .pipe(
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)")
      .refine((v) => Number(v) >= 0, "Amount cannot be negative")
  );

export const generateBudgetSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  currency: z.nativeEnum(Currency),
});

export const updateBudgetAllocationsSchema = z.object({
  categories: z
    .array(
      z.object({
        categoryId: z.string().min(1, "Category is required"),
        allocated: nonNegativeAmountSchema,
        isEssential: z.boolean().optional(),
        note: z.string().trim().max(300).optional(),
      })
    )
    .min(1, "Provide at least one budget category allocation"),
});

export type GenerateBudgetInput = z.infer<typeof generateBudgetSchema>;
export type UpdateBudgetAllocationsInput = z.infer<typeof updateBudgetAllocationsSchema>;

