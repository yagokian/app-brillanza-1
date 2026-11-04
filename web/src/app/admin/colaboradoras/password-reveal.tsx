"use client";

import { useTranslations } from "next-intl";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// The temporary password exists only here: it is not stored anywhere readable and is shown once.
export function PasswordReveal({ email, password }: { email: string; password: string }) {
  const t = useTranslations("workers");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${email}\n${password}`);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-status-concluido/40 bg-status-concluido/8 p-4">
      <p className="flex items-center gap-2 font-medium">
        <KeyRound className="size-4" aria-hidden />
        {t("accessCreated")}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("fields.email")}</dt>
        <dd className="break-all">{email}</dd>
        <dt className="text-muted-foreground">{t("tempPassword")}</dt>
        <dd className="font-mono text-base font-semibold tracking-wider select-all">{password}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">{t("passwordOnce")}</p>
      <Button variant="outline" size="lg" onClick={copy} className="self-start">
        <Copy aria-hidden />
        {t("copy")}
      </Button>
    </div>
  );
}
