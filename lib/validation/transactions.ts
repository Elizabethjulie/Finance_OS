import Decimal from "decimal.js";
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
  .refine((val) => new Decimal(val).gt(0), {
    message: "Amount must be greater than zero.",
  });

export const createTransactionSchema = z
  .object({
    accountId: z.string().trim().min(1, "Choose an account."),
    transferAccountId: z.string().trim().optional().or(z.literal("")),
    categoryId: z.string().trim().optional().or(z.literal("")),
    type: transactionTypeEnum,
    amount: moneyAmount,
    currency: currencyEnum,
    description: z.string().trim().min(1, "Add a short description.").max(200),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    date: z
      .string()
      .min(1, "Date is required.")
      .refine((val) => !Number.isNaN(Date.parse(val)), { message: "Enter a valid date." }),
  })
  .superRefine((data, ctx) => {
    const dest = data.transferAccountId?.trim() ?? "";

    if (data.type === "TRANSFER") {
      if (!dest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose a destination account for a transfer.",
          path: ["transferAccountId"],
        });
      } else if (dest === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination must be different from the source.",
          path: ["transferAccountId"],
        });
      }
    } else if (dest) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only transfers can have a destination account.",
        path: ["transferAccountId"],
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// Editing `type`, `accountId`, `transferAccountId`, or `currency` is intentionally
// not supported here — delete and recreate the transaction instead.
export const updateTransactionSchema = z.object({
  amount: moneyAmount.optional(),
  description: z.string().trim().min(1, "Add a short description.").max(200).optional(),
  notes: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  date: z
    .string()
    .min(1, "Date is required.")
    .refine((val) => !Number.isNaN(Date.parse(val)), { message: "Enter a valid date." })
    .optional(),
  categoryId: z.string().trim().nullable().optional().or(z.literal("")),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(50),
  icon: z.string().trim().max(10).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;