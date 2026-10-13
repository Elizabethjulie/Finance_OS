"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import {
  BankIcon,
  FlowIcon,
  TargetIcon,
  BriefcaseIcon,
  LaptopIcon,
  TrendUpIcon,
  CalendarIcon,
  EmptyIllustration,
  PlusIcon,
} from "@/components/ui/icons";
import type { IncomeSource, Account, Transaction } from "@/lib/generated/prisma/client";

interface DashboardClientProps {
  user: {
    name: string;
    baseCurrency: string;
  };
  incomeSources: IncomeSource[];
  accounts: Account[];
  transactions: (Transaction & { account?: Account | null })[];
}

export function DashboardClient({
  user,
  incomeSources,
  accounts,
  transactions,
}: DashboardClientProps) {
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);

  // Compute realistic or fallback data
  const currencySymbol =
    user.baseCurrency === "KES"
      ? "KSh"
      : user.baseCurrency === "EUR"
      ? "€"
      : user.baseCurrency === "GBP"
      ? "£"
      : "$";

  // Calculate monthly income total from income sources
  const monthlyTotalNumber = incomeSources.reduce((acc, src) => {
    const val = Number(src.amount) || 0;
    const freq = (src.frequency || "MONTHLY").toUpperCase();
    if (freq === "WEEKLY" || freq === "WEEEKLY") return acc + val * 4.33;
    if (freq === "BIWEEKLY") return acc + val * 2.167;
    if (freq === "QUARTERLY") return acc + val / 3;
    if (freq === "ANNUALLY") return acc + val / 12;
    return acc + val;
  }, 0);

  const formattedMonthlyTotal =
    monthlyTotalNumber > 0
      ? `${currencySymbol}${monthlyTotalNumber.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `${currencySymbol}5,900.00`;

  // Display recurring income sources: if none in db, preview mock items matching screenshot
  const displaySources =
    incomeSources.length > 0
      ? incomeSources
      : [
          {
            id: "src-1",
            name: "Product Designer at Acme Co",
            amount: 4200.0,
            currency: user.baseCurrency,
            frequency: "MONTHLY",
          },
          {
            id: "src-2",
            name: "Freelance Consulting",
            amount: 850.0,
            currency: user.baseCurrency,
            frequency: "BIWEEKLY",
          },
        ];

  // Net worth calculation from transactions / accounts
  const totalNetWorthNumber = transactions.reduce((acc, tx) => {
    const val = Number(tx.amount) || 0;
    if (tx.type === "INCOME") return acc + val;
    if (tx.type === "EXPENSE") return acc - val;
    return acc;
  }, 0);

  const formattedNetWorth =
    transactions.length > 0
      ? `${currencySymbol}${totalNetWorthNumber.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : `${currencySymbol}0.00`;

  // Format today's date
  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      {/* Shared Navigation Header */}
      <Header
        userName={user.name || "Alex Morgan"}
        planName="Standard Plan"
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* Top Greeting & Date Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Good morning, {user.name.split(" ")[0] || "Alex"} <span className="text-2xl">👋</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Here is your fresh financial workspace. Everything is calm and up to date.
            </p>
          </div>

          <div className="self-start sm:self-auto inline-flex items-center gap-2 bg-white border border-[#E5EBE8] px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-600 shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {todayFormatted} • {user.baseCurrency} Baseline
            </span>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total Net Worth */}
          <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 sm:p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3">
              <span>Total Net Worth</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <BankIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 my-1">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {formattedNetWorth}
              </span>
              <span className="text-xs font-semibold text-slate-400 uppercase">
                {user.baseCurrency}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>
                {transactions.length === 0
                  ? "Awaiting first transaction data"
                  : "Updated with latest logs"}
              </span>
            </div>
          </div>

          {/* Card 2: Monthly Cash Flow */}
          <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 sm:p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3">
              <span>Monthly Cash Flow</span>
              <div className="w-8 h-8 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                <FlowIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 my-1">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {currencySymbol}0.00
              </span>
              <span className="text-xs font-semibold text-slate-400">/ mo</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span>Awaiting first transaction data</span>
            </div>
          </div>

          {/* Card 3: Active Savings Goal */}
          <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 sm:p-6 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-3">
              <span>Active Savings Goal</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TargetIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 my-1">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Target: {currencySymbol}10k
              </span>
              <span className="text-xs font-medium text-slate-500">Emergency Fund</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Awaiting first transaction data</span>
            </div>
          </div>
        </div>

        {/* Lower Main Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Recurring Income Baseline */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5EBE8] p-6 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-900">Recurring Income Baseline</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5F1] text-[#0F5147]">
                  + {displaySources.length} active sources
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Automated salary and retainer schedule
              </p>

              {/* Source Rows */}
              <div className="space-y-4">
                {displaySources.map((source, index) => {
                  const isFirst = index === 0;
                  const amt = Number(source.amount) || 0;
                  const freqText =
                    source.frequency?.toLowerCase() === "biweekly"
                      ? "/ bi-weekly"
                      : source.frequency?.toLowerCase() === "weekly" ||
                        source.frequency?.toLowerCase() === "weeekly"
                      ? "/ weekly"
                      : "/ month";
                  const nextDate = isFirst ? "Nov 1st" : "Oct 28th";

                  return (
                    <div
                      key={source.id}
                      className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isFirst ? "bg-[#E8F5F1] text-[#0F5147]" : "bg-orange-50 text-amber-600"
                          }`}
                        >
                          {isFirst ? (
                            <BriefcaseIcon className="w-4 h-4" />
                          ) : (
                            <LaptopIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-semibold text-slate-900">
                            {source.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>Next expected: {nextDate}</span>
                            <span>•</span>
                            <span>{freqText}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-sm font-bold text-[#0F5147]">
                        +{currencySymbol}
                        {amt.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Total Card */}
            <div className="mt-8 rounded-xl bg-[#F0F9F6] border border-[#D1EFE6] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                  <TrendUpIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-700">Monthly Total</span>
              </div>
              <div className="text-sm font-bold text-[#0F5147]">
                {formattedMonthlyTotal}{" "}
                <span className="text-[11px] font-normal text-slate-500">estimated / mo</span>
              </div>
            </div>
          </div>

          {/* Right Column: Empty State or Transactions list */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5EBE8] p-8 sm:p-12 shadow-xs flex flex-col items-center justify-center text-center">
            {transactions.length === 0 ? (
              <>
                {/* Empty Illustration with layered icons */}
                <EmptyIllustration className="mb-6" />

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 max-w-md">
                  Nothing here yet — add your first transaction to get started
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 mt-2.5 max-w-md leading-relaxed">
                  Finance OS gets smarter and more helpful with every log. Whether it&apos;s your
                  morning coffee, a paycheck, or rent, logging takes less than 10 seconds.
                </p>

                {/* Main CTA: Log transaction button */}
                <button
                  type="button"
                  onClick={() => setIsAddTransactionOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all hover:shadow-md cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Log your first transaction</span>
                </button>

                {/* Secondary buttons */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddTransactionOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition-colors"
                  >
                    <span>📥</span>
                    <span>Import CSV from your bank</span>
                  </button>
                  <Link
                    href="/dashboard/accounts"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 transition-colors"
                  >
                    <span>✨</span>
                    <span>Explore sample insights</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="w-full text-left">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
                  <button
                    type="button"
                    onClick={() => setIsAddTransactionOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5147] hover:underline"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add New</span>
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-900">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(tx.date).toLocaleDateString()} • {tx.account?.name || "Account"}
                        </p>
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-bold ${
                          tx.type === "INCOME" ? "text-[#0F5147]" : "text-slate-800"
                        }`}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}
                        {currencySymbol}
                        {Number(tx.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Helpful Tip Bar */}
        <div className="rounded-xl bg-[#FEF9EE] border border-[#FDE68A] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="text-base text-amber-600">💡</span>
            <span>
              <strong>Helpful Tip:</strong> Finance OS safeguards your privacy with on-device
              encryption and bank-grade privacy standards.
            </span>
          </div>
          <a
            href="#"
            className="font-medium text-[#0F5147] hover:underline whitespace-nowrap self-end sm:self-auto"
          >
            Learn how we handle data →
          </a>
        </div>
      </main>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />
    </div>
  );
}

