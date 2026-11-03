"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserX } from "lucide-react";
import { toast } from "sonner";
import { anonimizarCliente } from "@/app/admin/clientes/actions";
import { anonimizarColaboradora } from "@/app/admin/colaboradoras/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonKind } from "@/lib/rgpd";

const actions = { cliente: anonimizarCliente, colaboradora: anonimizarColaboradora };
const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();

// Irreversible: the admin has to type the person's name to enable the button.
export function AnonymizeButton({ kind, id, nome }: { kind: PersonKind; id: string; nome: string }) {
  const t = useTranslations("rgpd");
  const tf = useTranslations("form");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = normalize(typed) === normalize(nome);

  const confirm = () =>
    startTransition(async () => {
      const result = await actions[kind](id);
      if (result.ok) {
        setOpen(false);
        toast.success(t("anonymizeDone"));
        router.refresh();
      } else {
        toast.error(result.error === "noSecretKey" ? t("noSecretKey") : tf("failed"));
      }
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="lg" disabled={pending} />}>
        <UserX aria-hidden />
        {t("anonymize")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`anonymizeTitle.${kind}`)}</AlertDialogTitle>
          <AlertDialogDescription render={<div />} className="flex flex-col gap-2 text-left">
            <p>
              <strong>{t("erased")}</strong> {t(`erasedList.${kind}`)}
            </p>
            <p>
              <strong>{t("kept")}</strong> {t("keptList")}
            </p>
            <p>{t("exportFirst")}</p>
            <p className="font-medium text-destructive">{t("irreversible")}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="anonymize-confirm">{t("typeName", { name: nome })}</Label>
          <Input id="anonymize-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="h-11" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending || !matches}>
            {t("anonymize")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
