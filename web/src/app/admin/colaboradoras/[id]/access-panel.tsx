"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, Power } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gerarAcesso, setColaboradoraAtiva } from "../actions";
import { PasswordReveal } from "../password-reveal";

export function AccessPanel({ id, ativo, hasLogin, hasEmail }: { id: string; ativo: boolean; hasLogin: boolean; hasEmail: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  const toggle = () =>
    startTransition(async () => {
      const { ok } = await setColaboradoraAtiva(id, !ativo);
      if (!ok) {
        toast.error(t("form.failed"));
        return;
      }
      setRevealed(null);
      toast.success(ativo ? t("workers.deactivated") : t("workers.activated"));
      router.refresh();
    });

  const access = () => {
    if (hasLogin && !window.confirm(t("workers.resetConfirm"))) return;
    startTransition(async () => {
      const result = await gerarAcesso(id, locale);
      if (!result.ok) {
        toast.error(t(`workers.errors.${result.error}`));
        return;
      }
      setRevealed({ email: result.email, password: result.password });
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("workers.sections.access")}
          <Badge variant={ativo ? "default" : "secondary"}>{ativo ? t("workers.active") : t("workers.inactive")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{hasLogin ? t("workers.hasLogin") : t("workers.noLoginText")}</p>
        {revealed && <PasswordReveal {...revealed} />}
        {ativo && (
          <Button variant="outline" size="lg" onClick={access} disabled={pending || !hasEmail} className="self-start">
            <KeyRound aria-hidden />
            {hasLogin ? t("workers.resetPassword") : t("workers.createAccess")}
          </Button>
        )}
        {ativo && !hasEmail && <p className="text-xs text-muted-foreground">{t("workers.errors.noEmail")}</p>}
        <Button variant={ativo ? "destructive" : "default"} size="lg" onClick={toggle} disabled={pending} className="self-start">
          <Power aria-hidden />
          {ativo ? t("workers.deactivate") : t("workers.activate")}
        </Button>
        {ativo && <p className="text-xs text-muted-foreground">{t("workers.deactivateHint")}</p>}
      </CardContent>
    </Card>
  );
}
