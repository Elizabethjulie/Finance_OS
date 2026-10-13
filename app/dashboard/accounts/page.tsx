import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { AccountsClient } from "./AccountsClient";

export default async function AccountsPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, baseCurrency: true, onboardedAt: true },
  });

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  const accounts = await listAccounts(userId);

  return (
    <AccountsClient
      user={{
        name: user.name,
        baseCurrency: user.baseCurrency,
      }}
      accounts={accounts}
    />
  );
}

