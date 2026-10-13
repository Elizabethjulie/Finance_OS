"use client";

import React, { useState, useEffect } from "react";
import { CloseIcon, CheckIcon, CalendarIcon } from "@/components/ui/icons";
import { createTransactionAction } from "@/app/dashboard/actions";
import type { Account } from "@/lib/generated/prisma/client";

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  defaultCurrency?: string;
  defaultType?: "INCOME" | "EXPENSE" | "TRANSFER";
}

const INCOME_CATEGORIES = [
  { id: "freelance", name: "Freelance Income", icon: "💼" },
  { id: "salary", name: "Salary & Wages", icon: "💳" },
  { id: "gift", name: "Gift", icon: "🎁" },
  { id: "investment", name: "Investments & Dividends", icon: "📈" },
  { id: "other_income", name: "Other Income", icon: "📊" },
];

const EXPENSE_CATEGORIES = [
  { id: "food", name: "Food & Dining", icon: "🍽️" },
  { id: "housing", name: "Housing & Rent", icon: "🏠" },
  { id: "transport", name: "Transportation", icon: "🚗" },
  { id: "utilities", name: "Utilities", icon: "⚡" },
  { id: "entertainment", name: "Entertainment", icon: "🍿" },
  { id: "shopping", name: "Shopping", icon: "🛍️" },
  { id: "health", name: "Health & Medical", icon: "🩺" },
  { id: "other_expense", name: "Other Expense", icon: "📝" },
];

const TRANSFER_CATEGORIES = [
  { id: "transfer_bank", name: "Bank Transfer", icon: "🔄" },
  { id: "savings", name: "Savings Transfer", icon: "🏦" },
  { id: "investment_transfer", name: "Investment Transfer", icon: "🌱" },
];

export function AddTransactionModal({
  isOpen,
  onClose,
  accounts,
  defaultCurrency = "USD",
  defaultType = "INCOME",
}: AddTransactionModalProps) {
  const [activeType, setActiveType] = useState<"EXPENSE" | "INCOME" | "TRANSFER">(defaultType);
  const [amount, setAmount] = useState("1850.00");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedCategory, setSelectedCategory] = useState("Freelance Income");
  const [description, setDescription] = useState("Acme Client: Milestone Payout");
  const [notes, setNotes] = useState("Q4 project final deliverable signed off. #tax-deductible #freelance");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accounts.length > 0 && (!accountId || !accounts.some((a) => a.id === accountId))) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (activeType === "INCOME") {
      setSelectedCategory("Freelance Income");
      setDescription("Acme Client: Milestone Payout");
    } else if (activeType === "EXPENSE") {
      setSelectedCategory("Food & Dining");
      setDescription("Grocery store & fresh market");
    } else {
      setSelectedCategory("Bank Transfer");
      setDescription("Transfer to savings wallet");
    }
  }, [activeType]);

  if (!isOpen) return null;

  const currentCategories =
    activeType === "INCOME"
      ? INCOME_CATEGORIES
      : activeType === "EXPENSE"
      ? EXPENSE_CATEGORIES
      : TRANSFER_CATEGORIES;

  const currencySymbol =
    defaultCurrency === "KES"
      ? "KSh"
      : defaultCurrency === "EUR"
      ? "€"
      : defaultCurrency === "GBP"
      ? "£"
      : "$";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (!accountId) {
      setError("Please choose an account");
      return;
    }

    setIsPending(true);

    try {
      const result = await createTransactionAction({
        accountId,
        type: activeType,
        amount: Number(amount).toFixed(2),
        currency: defaultCurrency as any,
        description: description.trim() || `${activeType} - ${selectedCategory}`,
        notes: notes.trim(),
        date: new Date(date).toISOString(),
      });

      if (result.error) {
        setError(result.error);
        setIsPending(false);
      } else {
        setIsPending(false);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
      setIsPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F5147] tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-[#0F5147]" />
              NEW ENTRY
            </div>
            <h2 className="text-xl font-bold text-slate-900">Add a Transaction</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quick and simple. Keep your finances clear and stress-free.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100/80 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setActiveType("EXPENSE")}
            className={`py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeType === "EXPENSE"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setActiveType("INCOME")}
            className={`py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeType === "INCOME"
                ? "bg-[#0F5147] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            + Income
          </button>
          <button
            type="button"
            onClick={() => setActiveType("TRANSFER")}
            className={`py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
              activeType === "TRANSFER"
                ? "bg-[#0F5147] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 focus-within:border-[#0F5147] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F5147]/10 transition-all">
              <span className="text-xl font-bold text-slate-700 mr-2">{currencySymbol}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent text-xl font-bold text-slate-900 focus:outline-none placeholder:text-slate-300"
              />
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#E8F5F1] text-[#0F5147]">
                {defaultCurrency}
              </span>
            </div>
          </div>

          {/* Account & Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {activeType === "INCOME" ? "Deposit Account" : "Account"}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — {acc.currency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date & Time</label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
                />
              </div>
            </div>
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {currentCategories.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#D1EFE6] text-[#0F5147] border border-[#0F5147]/40 ring-1 ring-[#0F5147]/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-transparent"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    {isSelected && <CheckIcon className="w-3.5 h-3.5 ml-0.5 text-[#0F5147]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description / Payee */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Description / Payee
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Acme Client: Milestone Payout"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            />
          </div>

          {/* Notes & Tags */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500">Notes & Tags</label>
              <span className="text-[11px] text-slate-400">Optional</span>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add personal notes, hashtags like #freelance, or tax info"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147] resize-none"
            />
          </div>

          {/* Clarity tip callout */}
          <div className="rounded-xl bg-[#F0F9F6] border border-[#D5EFE7] p-2.5 flex items-center gap-2 text-xs text-[#0F5147]">
            <span className="text-base">🌱</span>
            <span>Logging consistently gives you clarity without the stress.</span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-[#0F5147] hover:bg-[#0C433A] disabled:opacity-50 rounded-lg shadow-xs transition-all"
            >
              {isPending ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Save Transaction</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

