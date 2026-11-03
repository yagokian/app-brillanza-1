"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyMfa } from "./actions";

export function MfaForm({ factorId }: { factorId: string }) {
  const t = useTranslations("mfa");
  const [state, action, pending] = useActionState(verifyMfa, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("code")}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className="h-11 text-center text-lg tracking-[0.3em] tabular-nums"
        />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("invalid")}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
