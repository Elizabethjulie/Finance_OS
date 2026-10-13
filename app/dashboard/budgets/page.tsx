import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { Header } from "@/components/Header";
import { TargetIcon } from "@/components/ui/icons";

export default async function BudgetsPage() {
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
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      <Header
        userName={user.name}
        planName="Standard Plan"
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="bg-white rounded-3xl border border-[#E5EBE8] p-8 max-w-lg w-full shadow-xs flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <TargetIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Budgets &amp; Envelopes</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            Budget envelopes and expense allocation are coming in the next release.
          </p>
        </div>
      </main>
    </div>
  );
}

