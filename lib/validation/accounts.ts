import { z } from "zod";
import { currencyEnum } from "./onboarding";

export const accountTypeEnum = z.enum([
  "BANK",
  "MOBILE_MONEY",
  "MMF",
  "INVESTMENT",
  "CASH",
  "SAVINGS",
  "OTHER",
]);

const openingBalanceAmount = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val === undefined || val === "" ? "0" : val))
  .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
    message: "Enter a valid opening balance (non-negative, up to 2 decimal places).",
  });

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(100),
  type: accountTypeEnum,
  currency: currencyEnum,
  openingBalance: openingBalanceAmount,
});

export type CreateAccountInput = z.input<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(100).optional(),
  type: accountTypeEnum.optional(),
  currency: currencyEnum.optional(),
  isArchived: z.boolean().optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;