"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

// Must be rendered inside the <form> whose pending state it reports —
// useFormStatus reads context from the nearest parent form.
export function SubmitButton({ children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} {...props}>
      {children}
    </Button>
  );
}