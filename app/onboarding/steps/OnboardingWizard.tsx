"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FinanceOSLogo, CheckIcon } from "@/components/ui/icons";
import { PersonalInfoStep } from "../steps/PersonalInfoStep";
import { IncomeStep } from "../steps/IncomeStep";
import { savePersonalInfoAction, completeOnboardingAction } from "../actions";
import type { PersonalInfoInput } from "@/lib/validation/onboarding";

interface Props {
  initialValues: PersonalInfoInput;
}

export function OnboardingWizard({ initialValues }: Props) {
  const [stepIndex, setStepIndex] = useState(1); // Default to Step 2 to match mockup!
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoInput>(initialValues);

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-[#E5EBE8] px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="transition-opacity hover:opacity-90">
            <FinanceOSLogo />
          </Link>

          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-100">
              Step {stepIndex + 1} of 3
            </span>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              Save &amp; finish later
            </Link>
          </div>
        </div>
      </header>

      {/* Main wizard body */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col gap-6">
        {/* Stepper Card */}
        <div className="bg-white rounded-2xl border border-[#E5EBE8] p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-center max-w-md mx-auto">
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stepIndex >= 1
                    ? "bg-[#0F5147] text-white"
                    : "bg-[#0F5147] text-white"
                }`}
              >
                {stepIndex > 0 ? <CheckIcon className="w-4 h-4 text-white" /> : "1"}
              </div>
              <span className="text-[11px] font-medium text-slate-600 mt-1.5">Personal info</span>
            </div>

            {/* Connecting Bar */}
            <div className="flex-1 h-0.5 mx-3 -mt-5 bg-[#0F5147]" />

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stepIndex >= 1
                    ? "bg-[#0F5147] text-white ring-4 ring-[#E8F5F1]"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                2
              </div>
              <span
                className={`text-[11px] mt-1.5 ${
                  stepIndex >= 1 ? "font-semibold text-slate-800" : "font-medium text-slate-400"
                }`}
              >
                Income sources
              </span>
            </div>
          </div>
        </div>

        {/* Current Step Content */}
        {stepIndex === 0 && (
          <PersonalInfoStep
            defaultValues={personalInfo}
            onNext={async (data) => {
              const result = await savePersonalInfoAction(data);
              if (!result.error) {
                setPersonalInfo(data);
                setStepIndex(1);
              }
              return result;
            }}
          />
        )}

        {stepIndex === 1 && (
          <IncomeStep
            defaultCurrency={personalInfo.baseCurrency}
            onBack={() => setStepIndex(0)}
            onSubmit={(data) => completeOnboardingAction(data)}
          />
        )}
      </main>
    </div>
  );
}