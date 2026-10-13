import { z } from "zod";
import { currencyEnum } from "./onboarding";

export const transactionTypeEnum = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "INVESTMENT_CONTRIBUTION",
  "WITHDRAWAL",
  "REFUND",
]);

// Same money-amount rule as onboarding's income sources — a plain
// decimal string, max 2 decimal places, strictly positive. Transaction
// amounts are always stored as positive numbers; direction comes from
// `type`, not sign, so there's exactly one way to represent "spent 500
// on food" and no ambiguity about what a negative amount would mean.
const moneyAmount = z
  .string()
  .trim()
  .min(1, "Amount is required.")
  .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
    message: "Enter a valid amount (up to 2 decimal places).",
  })
  .refine((val) => Number(val) > 0, { message: "Amount must be greater than zero." });

export const createTransactionSchema = z.object({
  accountId: z.string().min(1, "Choose an account."),
  categoryId: z.string().optional(),
  type: transactionTypeEnum,
  amount: moneyAmount,
  currency: currencyEnum,
  description: z.string().trim().min(1, "Add a short description.").max(200),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  date: z
    .string()
    .min(1, "Date is required.")
    .refine((val) => !Number.isNaN(Date.parse(val)), { message: "Enter a valid date." }),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(50),
  icon: z.string().trim().max(10).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;