import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listAccounts } from "@/services/account/account";
import { listCategories } from "@/services/category/category";
import { getBudgetWithActuals } from "@/services/budget/budget";
import { BudgetsClient } from "./BudgetsClient";

interface BudgetsPageProps {
  searchParams?: {
    year?: string;
    month?: string;
  };
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
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

  // Determine current year and month in Africa/Nairobi timezone as fallback
  const nairobiParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());

  const fallbackYear = Number(
    nairobiParts.find((p) => p.type === "year")?.value ?? new Date().getUTCFullYear()
  );
  const fallbackMonth = Number(
    nairobiParts.find((p) => p.type === "month")?.value ?? new Date().getUTCMonth() + 1
  );

  const selectedYear = searchParams?.year ? Number(searchParams.year) : fallbackYear;
  const selectedMonth = searchParams?.month ? Number(searchParams.month) : fallbackMonth;

  const validYear = Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100 ? selectedYear : fallbackYear;
  const validMonth = Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : fallbackMonth;

  const [accounts, categories, budget] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
    getBudgetWithActuals(userId, {
      year: validYear,
      month: validMonth,
      currency: user.baseCurrency,
    }),
  ]);

  return (
    <BudgetsClient
      user={{
        name: user.name,
        baseCurrency: user.baseCurrency,
      }}
      accounts={accounts}
      categories={categories}
      initialBudget={budget}
      selectedYear={validYear}
      selectedMonth={validMonth}
    />
  );
}
