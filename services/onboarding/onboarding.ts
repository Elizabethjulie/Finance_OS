import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  personalInfoSchema,
  incomeStepSchema,
  type PersonalInfoInput,
  type IncomeStepInput,
} from "@/lib/validation/onboarding";

export async function saveInitialPersonalInfo(userId: string, input: PersonalInfoInput) {
  const data = personalInfoSchema.parse(input);

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      baseCurrency: data.baseCurrency,
      country: data.country || null,
    },
    select: { id: true, name: true, baseCurrency: true, country: true },
  });
}

/**
 * Final onboarding step: writes all income sources and stamps
 * `onboardedAt`. Wrapped in a transaction so a partial failure never
 * leaves the user "half onboarded" — some income sources saved but
 * onboardedAt unset, or vice versa.
 */
export async function completeOnboarding(userId: string, input: IncomeStepInput) {
  const data = incomeStepSchema.parse(input);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.incomeSource.createMany({
      data: data.incomeSources.map((source) => ({
        userId,
        name: source.name,
        amount: source.amount,
        currency: source.currency,
        // normalize frequency string to the Prisma enum value.
        // Some generated Prisma enums may have unexpected spellings
        // (e.g. "WEEEKLY"). Coerce to the expected type here.
        frequency: ((): any => {
          if (source.frequency === "WEEKLY") return ("WEEEKLY" as any);
          return source.frequency as any;
        })(),
      })),
    });

    return tx.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
      select: { id: true, onboardedAt: true },
    });
  });
}

export async function isUserOnboarded(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardedAt: true },
  });
  return Boolean(user?.onboardedAt);
}