import { z } from "zod";

export const currencyEnum = z.enum(["KES", "EUR", "GBP", "USD"]);
export const frequencyEnum = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUALLY",
  "IRREGULAR",
]);

export const personalInfoSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  baseCurrency: currencyEnum,
  country: z.string().trim().max(100).optional().or(z.literal("")),
});

export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

// Amounts arrive as strings from form inputs — coerce carefully rather
// than trusting parseFloat, and reject non-finite/negative values.
const moneyAmount = z
  .string()
  .trim()
  .min(1, "Amount is required.")
  .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
    message: "Enter a valid amount (up to 2 decimal places).",
  })
  .refine((val) => Number(val) > 0, { message: "Amount must be greater than zero." });

export const incomeSourceSchema = z.object({
  name: z.string().trim().min(1, "Give this income source a name.").max(100),
  amount: moneyAmount,
  currency: currencyEnum,
  frequency: frequencyEnum,
});

export type IncomeSourceInput = z.infer<typeof incomeSourceSchema>;

export const incomeStepSchema = z.object({
  incomeSources: z
    .array(incomeSourceSchema)
    .min(1, "Add at least one income source to continue."),
});

export type IncomeStepInput = z.infer<typeof incomeStepSchema>;