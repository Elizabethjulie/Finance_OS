import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { OnboardingWizard } from "./steps/OnboardingWizard";

export default async function OnboardingPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, baseCurrency: true, country: true, onboardedAt: true },
  });

  if (user.onboardedAt) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialValues={{
        name: user.name,
        baseCurrency: user.baseCurrency,
        country: user.country ?? "",
      }}
    />
  );
}