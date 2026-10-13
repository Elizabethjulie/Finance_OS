"use client";

import React, { useState, FormEvent } from "react";
import { personalInfoSchema, type PersonalInfoInput } from "@/lib/validation/onboarding";

interface Props {
  defaultValues: PersonalInfoInput;
  onNext: (data: PersonalInfoInput) => Promise<{ error?: string } | void>;
}

export function PersonalInfoStep({ defaultValues, onNext }: Props) {
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    const formData = new FormData(e.currentTarget);
    const parsed = personalInfoSchema.safeParse({
      name: formData.get("name"),
      baseCurrency: formData.get("baseCurrency"),
      country: formData.get("country"),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setIsPending(true);
    const result = await onNext(parsed.data);
    setIsPending(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Welcome! Let&apos;s personalize your space
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          Set up your primary profile details and baseline currency. Everything stays private and secure.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto" noValidate>
        <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              name="name"
              type="text"
              defaultValue={defaultValues.name}
              placeholder="e.g. Alex Morgan"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Base Currency
            </label>
            <select
              name="baseCurrency"
              defaultValue={defaultValues.baseCurrency}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            >
              <option value="USD">USD — US Dollar ($)</option>
              <option value="KES">KES — Kenyan Shilling (KSh)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="GBP">GBP — British Pound (£)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Used as the default conversion baseline for reports and totals.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Country (optional)
            </label>
            <input
              name="country"
              type="text"
              defaultValue={defaultValues.country}
              placeholder="e.g. United States or Kenya"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:border-[#0F5147] focus:outline-none focus:ring-1 focus:ring-[#0F5147]"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-[#0F5147] hover:bg-[#0C433A] text-white px-7 py-3 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all hover:shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Saving..." : "Continue to Income Sources →"}
          </button>
        </div>
      </form>
    </div>
  );
}