import { z } from "zod";
import { Currency, GoalType } from "@/lib/generated/prisma/client";

const positiveAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (up to 2 decimal places)")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

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

export const createGoalSchema = z.object({
  name: z.string().trim().min(1, "Goal name is required").max(100),
  type: z.nativeEnum(GoalType).default("SAVINGS"),
  targetAmount: positiveAmountSchema,
  startingAmount: nonNegativeAmountSchema.optional().default("0"),
  currency: z.nativeEnum(Currency),
  targetDate: z.coerce.date({ message: "Choose a valid target date" }),
});

export const addGoalContributionSchema = z.object({
  goalId: z.string().min(1, "Choose a goal"),
  amount: positiveAmountSchema,
  currency: z.nativeEnum(Currency),
  transactionId: z.string().optional(),
  note: z.string().trim().max(300).optional(),
  contributedAt: z.coerce.date().optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type AddGoalContributionInput = z.infer<typeof addGoalContributionSchema>;

