"use client";

import React, { useState, useTransition } from "react";
import { Header } from "@/components/Header";
import {
  TrendUpIcon,
  PiggyBankIcon,
  TargetIcon,
  FlowIcon,
  CalendarIcon,
  RefreshIcon,
  CloseIcon,
  CheckIcon,
} from "@/components/ui/icons";
import {
  LuSparkles,
  LuInfo,
  LuChevronLeft,
  LuChevronRight,
  LuX,
} from "react-icons/lu";
import type { AIInsight, Account, Currency, InsightType } from "@/lib/generated/prisma/client";
import { generateInsightsAction, dismissInsightAction } from "./actions";

interface InsightsClientProps {
  user: {
    name: string;
    baseCurrency: Currency;
  };
  accounts: Account[];
  initialInsights: AIInsight[];
  initialYear: number;
  initialMonth: number;
  initialCurrency: Currency;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURRENCIES: Currency[] = ["KES", "EUR", "USD", "GBP"];

export function InsightsClient({
  user,
  accounts,
  initialInsights,
  initialYear,
  initialMonth,
  initialCurrency,
}: InsightsClientProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency);
  const [insights, setInsights] = useState<AIInsight[]>(initialInsights);
  const [isPending, startTransition] = useTransition();
  const [activeReasoningInsight, setActiveReasoningInsight] = useState<AIInsight | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function handlePrevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setInsights([]);
  }

  function handleNextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setInsights([]);
  }

  function handleSelectCurrency(c: Currency) {
    setSelectedCurrency(c);
    setInsights([]);
  }

  function handleGenerateInsights() {
    setNotice(null);
    startTransition(async () => {
      const res = await generateInsightsAction({
        year: selectedYear,
        month: selectedMonth,
        currency: selectedCurrency,
      });

      if (res.error) {
        setNotice({ message: res.error, type: "error" });
      } else if (res.insights) {
        setInsights(res.insights);
        setNotice({
          message: `Generated ${res.insights.length} verified observations for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`,
          type: "success",
        });
      }
    });
  }

  function handleDismiss(insightId: string) {
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
    startTransition(async () => {
      await dismissInsightAction(insightId);
    });
  }

  function renderInsightBadge(type: InsightType) {
    switch (type) {
      case "SAVINGS_OPPORTUNITY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <PiggyBankIcon className="w-3.5 h-3.5 text-emerald-700" />
            <span>Savings Opportunity</span>
          </span>
        );
      case "SPENDING_ALERT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <TargetIcon className="w-3.5 h-3.5 text-amber-700" />
            <span>Spending Alert</span>
          </span>
        );
      case "GOAL_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E8F5F1] text-[#0F5147] border border-[#CDEAE1]">
            <TrendUpIcon className="w-3.5 h-3.5 text-[#0F5147]" />
            <span>Goal Progress</span>
          </span>
        );
      case "CASH_FLOW_TREND":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <FlowIcon className="w-3.5 h-3.5 text-sky-700" />
            <span>Cash Flow Trend</span>
          </span>
        );
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      <Header
        userName={user.name}
        planName="Standard Plan"
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 flex flex-col gap-6">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold text-[#0F5147] tracking-wider mb-1 flex items-center gap-1.5">
              <LuSparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>FINANCIAL INTELLIGENCE (PHASE 7)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Monthly Financial Insights
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Plain-language observations synthesized from your verified ledger math.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Currency Selector Pill */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-full p-0.5 shadow-2xs">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCurrency(c)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCurrency === c
                      ? "bg-[#0F5147] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Month / Year Pagination */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-full px-2 py-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <LuChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="px-2.5 text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <LuChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Re-analyze / Generate Button */}
            <button
              type="button"
              disabled={isPending}
              onClick={handleGenerateInsights}
              className="inline-flex items-center gap-1.5 bg-[#0F5147] hover:bg-[#0C433A] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
              <span>{isPending ? "Analyzing..." : insights.length > 0 ? "Re-analyze" : "Generate Insights"}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {notice && (
          <div
            className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150 ${
              notice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span>{notice.message}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors ml-4 cursor-pointer"
              aria-label="Dismiss notice"
            >
              <LuX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Zero-Hallucination Philosophy Banner */}
        <div className="rounded-2xl bg-white border border-[#E5EBE8] px-4 py-3 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              <strong>Zero-Hallucination Engine:</strong> Gemini strictly interprets verified ledger
              calculations from application memory. AI never calculates or alters your balances.
            </span>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-semibold text-[#0F5147]">
            {selectedCurrency} Baseline
          </span>
        </div>

        {/* Main Content Area */}
        {insights.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E5EBE8] p-10 sm:p-16 text-center shadow-xs flex flex-col items-center justify-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center mb-5">
              <TrendUpIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              No Observations Yet for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-2 mb-6 leading-relaxed">
              Click below to run our token-optimized Gemini Flash analyzer on your verified numbers
              and personal memory profile.
            </p>
            <button
              type="button"
              disabled={isPending}
              onClick={handleGenerateInsights}
              className="inline-flex items-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white px-6 py-2.5 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
            >
              <LuSparkles className="w-4 h-4 text-amber-400" />
              <span>{isPending ? "Generating..." : "Generate Monthly Insights"}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {renderInsightBadge(insight.type)}
                    <button
                      type="button"
                      onClick={() => handleDismiss(insight.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Dismiss this insight"
                    >
                      <LuX className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5">{insight.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                    {insight.summary}
                  </p>

                  {insight.actionableStep && (
                    <div className="rounded-xl bg-[#F0F9F6] border border-[#D5EFE7] p-3 flex items-start gap-2.5 text-xs text-[#0F5147] mb-4">
                      <LuSparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Actionable Step:</strong> {insight.actionableStep}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Analyzed on {new Date(insight.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveReasoningInsight(insight)}
                    className="inline-flex items-center gap-1 font-semibold text-[#0F5147] hover:underline cursor-pointer"
                  >
                    <LuInfo className="w-3 h-3" />
                    <span>Why this insight?</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Interactive "Why?" Drawer / Modal */}
        {activeReasoningInsight && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-semibold text-[#0F5147] tracking-wider uppercase mb-1">
                    VERIFIED MATHEMATICAL GROUNDING
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {activeReasoningInsight.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveReasoningInsight(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-600">
                <p className="leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  {activeReasoningInsight.summary}
                </p>

                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Underlying Ledger Facts:</h4>
                  <pre className="bg-[#0D211C] text-emerald-300 p-4 rounded-xl text-[11px] overflow-x-auto font-mono">
                    {JSON.stringify(activeReasoningInsight.reasoning, null, 2)}
                  </pre>
                </div>

                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[11px] text-emerald-800 flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Zero-Hallucination Audit: Every claim in this insight maps directly to verified
                    numbers in your application database.
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveReasoningInsight(null)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0F5147] hover:bg-[#0C433A] rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
