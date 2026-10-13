"use client";

import React, { useState, useMemo } from "react";
import {
  incomeStepSchema,
  type IncomeSourceInput,
  type IncomeStepInput,
} from "@/lib/validation/onboarding";
import {
  BriefcaseIcon,
  LaptopIcon,
  TrashIcon,
  PlusIcon,
  TrendUpIcon,
  LightbulbIcon,
} from "@/components/ui/icons";

interface Props {
  defaultCurrency: IncomeSourceInput["currency"];
  onBack: () => void;
  onSubmit: (data: IncomeStepInput) => Promise<{ error?: string } | void>;
}

type DraftRow = IncomeSourceInput;

function defaultInitialRows(currency: DraftRow["currency"]): DraftRow[] {
  return [
    { name: "Primary Salary", amount: "4200.00", currency, frequency: "MONTHLY" },
    { name: "Freelance Design", amount: "850.00", currency, frequency: "BIWEEKLY" },
  ];
}

function emptyRow(currency: DraftRow["currency"]): DraftRow {
  return { name: "", amount: "", currency, frequency: "MONTHLY" };
}

export function IncomeStep({ defaultCurrency, onBack, onSubmit }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => defaultInitialRows(defaultCurrency));
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultCurrency)]);
  }

  function removeRow(index: number) {
    if (rows.length > 1) {
      setRows((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // Calculate estimated monthly baseline dynamically
  const monthlyBaseline = useMemo(() => {
    return rows.reduce((total, row) => {
      const num = parseFloat(row.amount);
      if (isNaN(num) || num <= 0) return total;

      switch (row.frequency) {
        case "WEEKLY":
          return total + num * 4.33;
        case "BIWEEKLY":
          return total + num * 2.167;
        case "MONTHLY":
          return total + num;
        case "QUARTERLY":
          return total + num / 3;
        case "ANNUALLY":
          return total + num / 12;
        default:
          return total + num;
      }
    }, 0);
  }, [rows]);

  const currencySymbol =
    defaultCurrency === "KES"
      ? "KSh"
      : defaultCurrency === "EUR"
      ? "€"
      : defaultCurrency === "GBP"
      ? "£"
      : "$";

  const formattedBaseline = `${currencySymbol}${monthlyBaseline.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  async function handleSubmit() {
    setError(undefined);

    // Clean up empty rows if multiple exist
    const validRows = rows.filter((r) => r.name.trim() !== "" || r.amount.trim() !== "");
    const toValidate = validRows.length > 0 ? validRows : rows;

    const parsed = incomeStepSchema.safeParse({ incomeSources: toValidate });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your income sources.");
      return;
    }

    setIsPending(true);
    const result = await onSubmit(parsed.data);
    setIsPending(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Title & Description */}
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Let&apos;s set up your regular income
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          Adding your typical income helps Finance OS build your monthly baseline. You can adjust
          this anytime.
        </p>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm font-bold text-slate-800">Recurring Incomes</span>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5F1] text-[#0F5147]">
          {rows.length} {rows.length === 1 ? "source" : "sources"} added
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {rows.map((row, index) => {
          const isPrimary = index === 0;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl border border-[#E5EBE8] p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isPrimary ? "bg-[#E8F5F1] text-[#0F5147]" : "bg-cyan-50 text-cyan-700"
                  }`}
                >
                  {isPrimary ? <BriefcaseIcon className="w-5 h-5" /> : <LaptopIcon className="w-5 h-5" />}
                </div>

                {/* Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1 items-center">
                  {/* Source Name */}
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Source Name
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRow(index, { name: e.target.value })}
                      placeholder="e.g. Primary Salary"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                    />
                  </div>

                  {/* Expected Amount */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Expected Amount
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-xs text-slate-400">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updateRow(index, { amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                      />
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Currency
                    </label>
                    <select
                      value={row.currency}
                      onChange={(e) =>
                        updateRow(index, { currency: e.target.value as DraftRow["currency"] })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                    >
                      <option value="USD">USD - $</option>
                      <option value="KES">KES - KSh</option>
                      <option value="EUR">EUR - €</option>
                      <option value="GBP">GBP - £</option>
                    </select>
                  </div>

                  {/* Frequency */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Frequency
                    </label>
                    <select
                      value={row.frequency}
                      onChange={(e) =>
                        updateRow(index, { frequency: e.target.value as DraftRow["frequency"] })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="BIWEEKLY">Bi-weekly</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="ANNUALLY">Annually</option>
                      <option value="IRREGULAR">Irregular</option>
                    </select>
                  </div>
                </div>

                {/* Trash Button */}
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors self-end sm:self-center"
                    aria-label="Remove income source"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add another income source button */}
      <button
        type="button"
        onClick={addRow}
        className="w-full py-3.5 rounded-2xl border border-dashed border-[#A5D8CD] bg-[#EBF7F4] hover:bg-[#DEEFEA] text-[#0F5147] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <PlusIcon className="w-4 h-4" />
        <span>Add another income source</span>
      </button>

      {/* Variable or irregular income callout */}
      <div className="rounded-2xl bg-[#FEF9EE] border border-[#FDE68A] p-4 sm:p-5 flex gap-3.5 items-start">
        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <LightbulbIcon className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-amber-950">
            Variable or irregular income?
          </h4>
          <p className="text-xs sm:text-sm text-amber-900/80 mt-1 leading-relaxed">
            Don&apos;t have fixed income? That&apos;s totally okay! Enter an average estimate, or skip
            for now and log payouts as they come in.
          </p>
        </div>
      </div>

      {/* Estimated Monthly Baseline Summary */}
      <div className="rounded-2xl bg-[#ECF8F6] border border-[#CFECE6] p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D1EFE6] text-[#0F5147] flex items-center justify-center">
            <TrendUpIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Estimated Monthly Baseline
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#0F5147] tracking-tight">
              {formattedBaseline} <span className="text-xs font-normal text-slate-500">/ month</span>
            </div>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-white/90 text-[#0F5147] border border-[#A5D8CD] shadow-2xs">
          Auto-calculated
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
          {error}
        </p>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Back to Personal Info
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="inline-flex items-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white px-7 py-3 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Completing setup..." : "Continue to Dashboard →"}
        </button>
      </div>
    </div>
  );
}