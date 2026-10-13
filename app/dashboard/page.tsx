import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { listTransactions } from "@/services/transaction/transaction";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, baseCurrency: true, onboardedAt: true, incomeSources: true },
  });

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  const [accounts, transactions] = await Promise.all([
    listAccounts(userId),
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
      transactions={transactions}
    />
  );
}