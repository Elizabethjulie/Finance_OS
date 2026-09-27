"use client";

import { useState } from "react";
import { PersonalInfoStep } from "../steps/PersonalInfoStep";
import { IncomeStep } from "../steps/IncomeStep";
import { savePersonalInfoAction, completeOnboardingAction } from "../actions";
import type { PersonalInfoInput } from "@/lib/validation/onboarding";
import { Card } from "@/components/ui/card";

interface Props {
  initialValues: PersonalInfoInput;
}

const STEPS = ["Personal info", "Income"] as const;

export function OnboardingWizard({ initialValues }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoInput>(initialValues);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                i <= stepIndex ? "bg-accent text-white" : "bg-border text-muted"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm ${i === stepIndex ? "font-medium text-foreground" : "text-muted"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      <Card>
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
      </Card>
    </main>
  );
}