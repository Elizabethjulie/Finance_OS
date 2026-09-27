"use client";

import { useState, FormEvent } from "react";
import { personalInfoSchema, type PersonalInfoInput } from "@/lib/validation/onboarding";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input label="Name" name="name" type="text" defaultValue={defaultValues.name} required />
      <Select
        label="Base currency"
        name="baseCurrency"
        defaultValue={defaultValues.baseCurrency}
        required
      >
        <option value="KES">KES — Kenyan Shilling</option>
        <option value="EUR">EUR — Euro</option>
        <option value="GBP">GBP — British Pound</option>
        <option value="USD">USD — US Dollar</option>
      </Select>
      <Input
        label="Country (optional)"
        name="country"
        type="text"
        defaultValue={defaultValues.country}
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={isPending} className="mt-2 self-end">
        Continue
      </Button>
    </form>
  );
}