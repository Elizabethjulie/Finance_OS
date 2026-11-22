"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import {
  TargetIcon,
  FlowIcon,
  PiggyBankIcon,
  TrendUpIcon,
  CalendarIcon,
  PlusIcon,
  RefreshIcon,
  CloseIcon,
  CheckIcon,
  LightbulbIcon,
} from "@/components/ui/icons";
import { LuChevronLeft, LuChevronRight, LuX, LuChevronDown, LuChevronUp, LuPencil } from "react-icons/lu";
import type { Account, Category, Currency, Transaction } from "@/lib/generated/prisma/client";
import type { BudgetVsActualSummary } from "@/lib/finance/budget";
import { getCurrencySymbol } from "@/lib/finance/money";
import { generateBudgetAction, updateBudgetAllocationsAction } from "@/app/budgets/actions";
import { updateTransactionAction } from "@/app/transactions/actions";

interface BudgetsClientProps {
  user: {
    name: string;
    baseCurrency: string;
  };
  accounts: Account[];
  categories: Category[];
  initialBudget: BudgetVsActualSummary | null;
  selectedYear: number;
  selectedMonth: number;
  selectedCurrency?: Currency;
  monthTransactions?: (Transaction & { account?: Account | null; category?: Category | null })[];
}

const CURRENCIES: Currency[] = ["KES", "EUR", "USD", "GBP"];

function formatWithCommas(amountStr: string): string {
  const parts = (amountStr || "0.00").split(".");
  const intPart = parts[0] || "0";
  const decPart = (parts[1] || "00").slice(0, 2).padEnd(2, "0");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${withCommas}.${decPart}`;
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

export function BudgetsClient({
  user,
  accounts,
  categories,
  initialBudget,
  selectedYear,
  selectedMonth,
  selectedCurrency,
  monthTransactions = [],
}: BudgetsClientProps) {
  const router = useRouter();
  const [isGenerating, startGenerating] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Spend editing states
  const [expandedEnvelopeId, setExpandedEnvelopeId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>("");
  const [isSavingTx, setIsSavingTx] = useState(false);

  // Editable category state for the adjustment modal
  const [editableAllocations, setEditableAllocations] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (initialBudget) {
      for (const cat of initialBudget.categories) {
        initial[cat.categoryId] = cat.allocated;
      }
    }
    return initial;
  });

  const activeCurrency = selectedCurrency || (initialBudget?.currency as Currency) || (user.baseCurrency as Currency);
  const currencySymbol = getCurrencySymbol(activeCurrency);

  function handleSaveTxAmount(txId: string) {
    if (!editingAmount || Number(editingAmount) <= 0) return;
    setIsSavingTx(true);
    startUpdating(async () => {
      const res = await updateTransactionAction(txId, {
        amount: Number(editingAmount).toFixed(2),
      });
      setIsSavingTx(false);
      if (res.error) {
        setFeedbackNotice({ type: "error", message: res.error });
      } else {
        setFeedbackNotice({
          type: "success",
          message: "Transaction amount updated. Envelope recalculated.",
        });
        setEditingTxId(null);
        router.refresh();
      }
      setTimeout(() => setFeedbackNotice(null), 3500);
    });
  }

  function handleMonthChange(newYear: number, newMonth: number) {
    router.push(`/dashboard/budgets?year=${newYear}&month=${newMonth}&currency=${activeCurrency}`);
  }

  function handleSelectCurrency(curr: Currency) {
    router.push(`/dashboard/budgets?year=${selectedYear}&month=${selectedMonth}&currency=${curr}`);
  }

  function handlePrevMonth() {
    if (selectedMonth === 1) {
      handleMonthChange(selectedYear - 1, 12);
    } else {
      handleMonthChange(selectedYear, selectedMonth - 1);
    }
  }

  function handleNextMonth() {
    if (selectedMonth === 12) {
      handleMonthChange(selectedYear + 1, 1);
    } else {
      handleMonthChange(selectedYear, selectedMonth + 1);
    }
  }

  function handleGenerateBudget() {
    startGenerating(async () => {
      const formData = new FormData();
      formData.set("year", String(selectedYear));
      formData.set("month", String(selectedMonth));
      formData.set("currency", activeCurrency);

      const res = await generateBudgetAction({}, formData);
      if (res.error) {
        setFeedbackNotice({ type: "error", message: res.error });
      } else {
        setFeedbackNotice({
          type: "success",
          message: `Goal-based budget generated for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} (${activeCurrency}).`,
        });
        router.refresh();
      }
      setTimeout(() => setFeedbackNotice(null), 4000);
    });
  }

  function handleOpenEditModal() {
    const initial: Record<string, string> = {};
    if (initialBudget) {
      for (const cat of initialBudget.categories) {
        initial[cat.categoryId] = cat.allocated;
      }
    }
    setEditableAllocations(initial);
    setIsEditModalOpen(true);
  }

  function handleSaveAllocations(e: React.FormEvent) {
    e.preventDefault();
    if (!initialBudget) return;

    startUpdating(async () => {
      const categoryInputs = Object.entries(editableAllocations).map(([categoryId, allocated]) => {
        const catRow = initialBudget.categories.find((c) => c.categoryId === categoryId);
        return {
          categoryId,
          allocated: allocated.trim() === "" ? "0.00" : allocated.trim(),
          isEssential: catRow?.isEssential ?? false,
        };
      });

      const res = await updateBudgetAllocationsAction(initialBudget.budgetId, {
        categories: categoryInputs,
      });

      if (res.error) {
        setFeedbackNotice({ type: "error", message: res.error });
      } else {
        setFeedbackNotice({
          type: "success",
          message: "Budget allocations updated successfully.",
        });
        setIsEditModalOpen(false);
        router.refresh();
      }
      setTimeout(() => setFeedbackNotice(null), 4000);
    });
  }

  // Calculate unallocated cushion if budget exists
  const unallocatedNumber = initialBudget
    ? Math.max(0, Number(initialBudget.expectedIncome) - Number(initialBudget.totalAllocated))
    : 0;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      <Header
        userName={user.name || "User"}
        planName="Standard Plan"
        accounts={accounts}
        defaultCurrency={user.baseCurrency}
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* Top Header & Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#E8F5F1] text-[#0F5147] mb-2">
              <TargetIcon className="w-3.5 h-3.5" />
              <span>Goal-Based Spending Envelopes</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Monthly Budget &amp; Allocations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Deterministic allocations prioritizing essentials, emergency savings, and goal deadlines.
            </p>
          </div>

          {/* Actions & Switchers */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Selector Pill */}
            <div className="inline-flex items-center bg-white border border-[#E5EBE8] rounded-full p-0.5 shadow-2xs">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCurrency(c)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    activeCurrency === c
                      ? "bg-[#0F5147] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Month / Year Switcher */}
            <div className="inline-flex items-center bg-white border border-[#E5EBE8] rounded-full p-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <LuChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="px-3 py-1 text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <LuChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {initialBudget && (
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-2xs cursor-pointer"
              >
                <span>Edit Allocations</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateBudget}
              className="inline-flex items-center gap-1.5 bg-[#0F5147] hover:bg-[#0C433A] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
            >
              <RefreshIcon className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              <span>{isGenerating ? "Generating..." : initialBudget ? "Regenerate Plan" : "Generate Budget"}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackNotice && (
          <div
            className={`rounded-2xl border p-4 text-xs font-medium flex items-center justify-between ${
              feedbackNotice.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span>{feedbackNotice.message}</span>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded ml-4 transition-colors"
              aria-label="Dismiss notice"
            >
              <LuX className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!initialBudget ? (
          /* Empty State: No budget generated yet */
          <div className="bg-white rounded-3xl border border-[#E5EBE8] p-10 sm:p-16 text-center shadow-xs flex flex-col items-center justify-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center mb-5">
              <TargetIcon className="w-7 h-7" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight max-w-md">
              No budget set for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2.5 max-w-lg leading-relaxed">
              Finance OS calculates your exact monthly baseline by looking at verified income sources,
              allocating essentials first, meeting active savings/investment goal deadlines, and buffering flexible expenses.
            </p>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateBudget}
              className="mt-7 inline-flex items-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white px-6 py-3 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{isGenerating ? "Calculating allocations..." : `Generate ${MONTH_NAMES[selectedMonth - 1]} Budget`}</span>
            </button>
          </div>
        ) : (
          /* Budget Content */
          <>
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Expected Income */}
              <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Expected Monthly Income</span>
                  <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                    <TrendUpIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currencySymbol}
                  {formatWithCommas(initialBudget.expectedIncome)}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Normalized monthly baseline
                </p>
              </div>

              {/* Card 2: Total Allocated */}
              <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Total Allocated</span>
                  <div className="w-7 h-7 rounded-lg bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center">
                    <FlowIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currencySymbol}
                  {formatWithCommas(initialBudget.totalAllocated)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2">
                  <span>Spent:</span>
                  <span className="font-semibold text-slate-800">
                    {currencySymbol}
                    {formatWithCommas(initialBudget.totalActualSpending)}
                  </span>
                </div>
              </div>

              {/* Card 3: Goals & Savings Target */}
              <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Savings &amp; Goals Target</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <PiggyBankIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currencySymbol}
                  {formatWithCommas(initialBudget.savingsTarget)}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Dedicated goal &amp; MMF funding
                </p>
              </div>

              {/* Card 4: Remaining Cushion / Unallocated */}
              <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Unallocated Buffer</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight">
                  +{currencySymbol}
                  {formatWithCommas(unallocatedNumber.toFixed(2))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Safe uncommitted cash cushion
                </p>
              </div>
            </div>

            {/* Plain-Language Rationale Card */}
            <div className="rounded-2xl bg-white border border-[#E5EBE8] p-5 sm:p-6 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8F5F1] text-[#0F5147] flex items-center justify-center shrink-0 mt-0.5">
                <LightbulbIcon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Allocation Strategy &amp; Rationale
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {initialBudget.rationale}
                </p>
              </div>
            </div>

            {/* Category Envelopes Table / List */}
            <div className="bg-white rounded-3xl border border-[#E5EBE8] shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Category Spending Envelopes</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Track real expenses against allocated budgets in real time.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500 self-start sm:self-auto">
                  {initialBudget.categories.length} category envelopes
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {initialBudget.categories.map((cat) => {
                  const percentNum = Number(cat.percentUsed) || 0;
                  const isOver = cat.isOverBudget;
                  const remainingNum = Number(cat.remaining) || 0;
                  const isCoinciding = Math.abs(remainingNum) < 0.005 && Number(cat.allocated) > 0;
                  const envelopeTxs = (monthTransactions || []).filter(
                    (t) => t.categoryId === cat.categoryId && t.type === "EXPENSE"
                  );

                  return (
                    <div key={cat.categoryId} className="p-6 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {cat.categoryName}
                          </span>
                          {cat.isEssential ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                              Essential
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Discretionary
                            </span>
                          )}
                          {isCoinciding ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              ✨ Coincides with allocation
                            </span>
                          ) : isOver ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Over budget by {currencySymbol}
                              {formatWithCommas(Math.abs(remainingNum).toFixed(2))}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-baseline gap-4 text-xs">
                          <div>
                            <span className="text-slate-400">Spent: </span>
                            <span className={`font-bold ${isOver ? "text-rose-600" : isCoinciding ? "text-blue-700" : "text-slate-900"}`}>
                              {currencySymbol}
                              {formatWithCommas(cat.actual)}
                            </span>
                          </div>
                          <span className="text-slate-300">/</span>
                          <div>
                            <span className="text-slate-400">Allocated: </span>
                            <span className="font-bold text-slate-900">
                              {currencySymbol}
                              {formatWithCommas(cat.allocated)}
                            </span>
                          </div>
                          <span className="text-slate-300">/</span>
                          <div>
                            <span className="text-slate-400">Remainder: </span>
                            <span
                              className={`font-bold ${
                                isCoinciding
                                  ? "text-blue-700"
                                  : remainingNum < 0
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {isCoinciding
                                ? `${currencySymbol}0.00 (Exact)`
                                : `${remainingNum < 0 ? "-" : "+"}${currencySymbol}${formatWithCommas(Math.abs(remainingNum).toFixed(2))}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver
                              ? "bg-rose-500"
                              : isCoinciding
                              ? "bg-blue-600"
                              : percentNum >= 80
                              ? "bg-amber-400"
                              : "bg-[#0F5147]"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, percentNum))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                        <span>{percentNum.toFixed(1)}% of envelope utilized</span>
                        <span>
                          {isCoinciding
                            ? "Exact match to allocation"
                            : isOver
                            ? "Alert: Exceeded allocation"
                            : `${currencySymbol}${formatWithCommas(Math.abs(remainingNum).toFixed(2))} remaining cushion`}
                        </span>
                      </div>

                      {/* Quick Spend View & Edit toggle */}
                      <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setExpandedEnvelopeId(expandedEnvelopeId === cat.categoryId ? null : cat.categoryId)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F5147] hover:underline cursor-pointer"
                        >
                          <LuPencil className="w-3.5 h-3.5" />
                          <span>
                            {expandedEnvelopeId === cat.categoryId
                              ? "Hide Spend Breakdown"
                              : `View & Edit Spend (${envelopeTxs.length} transaction${envelopeTxs.length === 1 ? "" : "s"})`}
                          </span>
                          {expandedEnvelopeId === cat.categoryId ? (
                            <LuChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <LuChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <span className="text-[11px] text-slate-500">
                          Envelope Status:{" "}
                          <strong
                            className={
                              isCoinciding
                                ? "text-blue-700"
                                : isOver
                                ? "text-rose-600"
                                : "text-emerald-700"
                            }
                          >
                            {isCoinciding
                              ? "Coincides 100% with budget"
                              : isOver
                              ? `Over by ${currencySymbol}${formatWithCommas(Math.abs(remainingNum).toFixed(2))}`
                              : `${currencySymbol}${formatWithCommas(remainingNum.toFixed(2))} remainder`}
                          </strong>
                        </span>
                      </div>

                      {/* Collapsible Spend Details & Inline Editor */}
                      {expandedEnvelopeId === cat.categoryId && (
                        <div className="mt-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Expenses in {cat.categoryName} ({activeCurrency})</span>
                            <span className="text-[11px] font-normal text-slate-500">
                              Total Spent: {currencySymbol}{formatWithCommas(cat.actual)}
                            </span>
                          </div>

                          {envelopeTxs.length === 0 ? (
                            <p className="text-xs text-slate-400 py-1">
                              No expenses logged for {cat.categoryName} this month.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-200/60">
                              {envelopeTxs.map((tx) => (
                                <div key={tx.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                  <div>
                                    <p className="font-semibold text-slate-900">{tx.description}</p>
                                    <p className="text-[10px] text-slate-400">
                                      {new Date(tx.date).toLocaleDateString()} • {tx.account?.name || "Account"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                    {editingTxId === tx.id ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-slate-600">{currencySymbol}</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0.01"
                                          value={editingAmount}
                                          onChange={(e) => setEditingAmount(e.target.value)}
                                          className="w-24 px-2 py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg text-right focus:outline-none focus:border-[#0F5147]"
                                          placeholder="0.00"
                                        />
                                        <button
                                          type="button"
                                          disabled={isSavingTx}
                                          onClick={() => handleSaveTxAmount(tx.id)}
                                          className="px-2.5 py-1 text-xs font-semibold bg-[#0F5147] text-white rounded-lg hover:bg-[#0C433A] cursor-pointer disabled:opacity-50"
                                        >
                                          {isSavingTx ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingTxId(null)}
                                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 rounded-lg"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2.5">
                                        <span className="font-bold text-slate-900">
                                          {currencySymbol}{formatWithCommas(String(tx.amount))}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingTxId(tx.id);
                                            setEditingAmount(String(tx.amount));
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-semibold text-[#0F5147] bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                          Edit Amount
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Adjust Allocations Modal */}
      {isEditModalOpen && initialBudget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E5EBE8] p-6 sm:p-8 max-w-xl w-full shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Customize Budget Allocations</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust monthly envelope amounts for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAllocations} className="flex-1 flex flex-col overflow-hidden pt-4">
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                {categories.map((cat) => {
                  const existingRow = initialBudget.categories.find((c) => c.categoryId === cat.id);
                  const isEssential = existingRow ? existingRow.isEssential : false;
                  const spentNum = existingRow ? Number(existingRow.actual) : 0;
                  const rawAlloc = editableAllocations[cat.id] ?? (existingRow?.allocated || "0.00");
                  const allocNum = Number(rawAlloc) || 0;
                  const diff = allocNum - spentNum;
                  const coincides = Math.abs(diff) < 0.005;

                  return (
                    <div
                      key={cat.id}
                      className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{cat.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {isEssential ? "Essential" : "Flexible"} • Spent so far:{" "}
                            <span className="font-semibold text-slate-700">
                              {currencySymbol}{spentNum.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 w-36">
                          <span className="text-xs font-semibold text-slate-500">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editableAllocations[cat.id] ?? ""}
                            onChange={(e) =>
                              setEditableAllocations((prev) => ({
                                ...prev,
                                [cat.id]: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            className="w-full text-right text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/50">
                        <span className="text-slate-500">Remainder / Left:</span>
                        <span
                          className={`font-semibold ${
                            coincides
                              ? "text-blue-700 font-bold"
                              : diff > 0
                              ? "text-emerald-700 font-bold"
                              : "text-rose-600 font-bold"
                          }`}
                        >
                          {coincides
                            ? `✨ Matches Spent Exactly (${currencySymbol}0.00 left)`
                            : diff > 0
                            ? `+${currencySymbol}${diff.toFixed(2)} remaining cushion`
                            : `-${currencySymbol}${Math.abs(diff).toFixed(2)} over allocated budget`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-5 border-t border-slate-100 mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 bg-[#0F5147] hover:bg-[#0C433A] text-white px-5 py-2 rounded-full text-xs font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? "Saving..." : "Save Allocations"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

