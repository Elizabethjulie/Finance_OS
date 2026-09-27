import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { IncomeSource } from "@/lib/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "./LogoutButton";

export default async function DashboardPage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, onboardedAt: true, incomeSources: true },
  });

  if (!user.onboardedAt) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Welcome, {user.name}</h1>
        <LogoutButton />
      </div>

      <Card>
        <h2 className="text-sm font-medium text-muted">Income sources</h2>
        {user.incomeSources.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No income sources yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {user.incomeSources.map((source: IncomeSource) => (
              <li
                key={source.id}
                className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0"
              >
                <span>{source.name}</span>
                <span className="tabular-nums text-muted">
                  {source.amount.toString()} {source.currency} / {source.frequency.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-sm text-muted">
        The full dashboard — balances, budget, goals, AI insights — arrives in Phase 3.
        This confirms the auth + onboarding flow is working end to end.
      </p>
    </main>
  );
}