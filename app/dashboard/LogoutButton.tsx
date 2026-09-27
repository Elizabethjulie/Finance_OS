"use client";

import { useTransition } from "react";
import { logoutAction } from "./actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      isLoading={isPending}
      onClick={() => startTransition(() => logoutAction())}
    >
      Log out
    </Button>
  );
}