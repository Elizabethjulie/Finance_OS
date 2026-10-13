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

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required.").max(100),
  type: accountTypeEnum,
  currency: currencyEnum,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;