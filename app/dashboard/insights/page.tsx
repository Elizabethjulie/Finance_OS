import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { listStoredMonthlyInsights } from "@/services/ai/insights";
import { InsightsClient } from "./InsightsClient";

export default async function InsightsPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, baseCurrency: true, onboardedAt: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [accounts, initialInsights] = await Promise.all([
    listAccounts(userId),
    listStoredMonthlyInsights(userId, {
      year: currentYear,
      month: currentMonth,
      currency: user.baseCurrency,
    }),
  ]);

  return (
    <InsightsClient
      user={{
        name: user.name,
        baseCurrency: user.baseCurrency,
      }}
      accounts={accounts}
      initialInsights={initialInsights}
      initialYear={currentYear}
      initialMonth={currentMonth}
      initialCurrency={user.baseCurrency}
    />
  );
}
