"use client";

import { useState } from "react";
import {
  incomeStepSchema,
  type IncomeSourceInput,
  type IncomeStepInput,
} from "@/lib/validation/onboarding";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  defaultCurrency: IncomeSourceInput["currency"];
  onBack: () => void;
  onSubmit: (data: IncomeStepInput) => Promise<{ error?: string } | void>;
}

type DraftRow = IncomeSourceInput;

function emptyRow(currency: DraftRow["currency"]): DraftRow {
  return { name: "", amount: "", currency, frequency: "MONTHLY" };
}

export function IncomeStep({ defaultCurrency, onBack, onSubmit }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(defaultCurrency)]);
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultCurrency)]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(undefined);
    const parsed = incomeStepSchema.safeParse({ incomeSources: rows });

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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Add every regular source of income — salary, freelance, side income. You can edit
        these anytime from Settings.
      </p>

      <div className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 rounded-md border border-border p-4 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
          >
            <Input
              label="Source"
              placeholder="e.g. Salary"
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
            <Input
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              onChange={(e) => updateRow(index, { amount: e.target.value })}
            />
            <Select
              label="Currency"
              value={row.currency}
              onChange={(e) =>
                updateRow(index, { currency: e.target.value as DraftRow["currency"] })
              }
            >
              <option value="KES">KES</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </Select>
            <Select
              label="Frequency"
              value={row.frequency}
              onChange={(e) =>
                updateRow(index, { frequency: e.target.value as DraftRow["frequency"] })
              }
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
              <option value="IRREGULAR">Irregular</option>
            </Select>
            <div className="flex items-end">
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove ${row.name || "this income source"}`}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={addRow} className="self-start">
        + Add another income source
      </Button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-2 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" isLoading={isPending} onClick={handleSubmit}>
          Finish setup
        </Button>
      </div>
    </div>
  );
}