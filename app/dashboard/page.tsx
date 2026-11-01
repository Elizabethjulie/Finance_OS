import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { getDashboardSummary } from "@/services/dashboard/summary";
import { listTransactions } from "@/services/transaction/transaction";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, baseCurrency: true, onboardedAt: true, incomeSources: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  // Determine current year and month in Africa/Nairobi timezone
  const nairobiParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const currentYear = Number(nairobiParts.find((p) => p.type === "year")?.value ?? new Date().getUTCFullYear());
  const currentMonth = Number(nairobiParts.find((p) => p.type === "month")?.value ?? new Date().getUTCMonth() + 1);

  const [accounts, dashboardSummary, transactions] = await Promise.all([
    listAccounts(userId),
    getDashboardSummary(userId, { year: currentYear, month: currentMonth }),
    listTransactions(userId, 20),
  ]);

  return (
    <DashboardClient
      user={{
        name: user.name,
        baseCurrency: user.baseCurrency,
      }}
      incomeSources={user.incomeSources}
      accounts={accounts}
      accountBalances={dashboardSummary.accounts}
      dashboardSummary={dashboardSummary}
      transactions={transactions}
    />
  );
}