"use client";

import React, { useState } from "react";
import { CloseIcon, CheckIcon } from "@/components/ui/icons";
import { createAccountAction } from "@/app/dashboard/actions";
import type { AccountType } from "@/lib/generated/prisma/client";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: AccountType;
  defaultCurrency?: string;
}

const ACCOUNT_TYPES: { id: AccountType; label: string; icon: string }[] = [
  { id: "BANK", label: "Bank Account", icon: "🏦" },
  { id: "SAVINGS", label: "Savings Account", icon: "🐖" },
  { id: "MOBILE_MONEY", label: "Mobile Money / Digital Wallet", icon: "📱" },
  { id: "MMF", label: "Money Market Fund (MMF)", icon: "📈" },
  { id: "CASH", label: "Physical Cash", icon: "💵" },
  { id: "INVESTMENT", label: "Investments & Stocks", icon: "🌱" },
  { id: "OTHER", label: "Other Account", icon: "💳" },
];

export function AddAccountModal({
  isOpen,
  onClose,
  defaultType = "BANK",
  defaultCurrency = "USD",
}: AddAccountModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>(defaultType);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter an account name");
      return;
    }

    setIsPending(true);
    try {
      const result = await createAccountAction({
        name: name.trim(),
        type,
        currency: currency as "USD" | "KES" | "EUR" | "GBP",
      });

      if (result.error) {
        setError(result.error);
        setIsPending(false);
      } else {
        setName("");
        setIsPending(false);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setIsPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] font-semibold text-[#0F5147] tracking-wider mb-1">
              CONNECT ACCOUNT
            </div>
            <h2 className="text-xl font-bold text-slate-900">Add Account or Wallet</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add a new financial account to organize your balances.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chase Premier Checking"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            >
              <option value="USD">USD — US Dollar</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#0F5147] hover:bg-[#0C433A] disabled:opacity-50 rounded-lg shadow-xs transition-all"
            >
              {isPending ? (
                <span>Adding...</span>
              ) : (
                <>
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Add Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

