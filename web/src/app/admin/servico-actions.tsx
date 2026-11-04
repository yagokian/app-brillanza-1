"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceStatus } from "@/lib/servicos";
import { cancelarServico, excluirServico, type ServicoResult } from "./agenda/actions";

// Cancel (with reason) and delete (only if it never started) for one service.
// `afterDelete` is where to go once the service no longer exists.
export function ServicoActions({
  id,
  status,
  started,
  label,
  afterDelete,
  size = "icon",
}: {
  id: string;
  status: ServiceStatus;
  started: boolean;
  label: string;
  afterDelete?: string;
  size?: "icon" | "lg";
}) {
  const t = useTranslations("serviceActions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<"cancel" | "delete" | null>(null);
  const [motivo, setMotivo] = useState("");
  const canCancel = status === "agendado" || status === "em_andamento";
  const canDelete = (status === "agendado" || status === "cancelado") && !started;
  if (!canCancel && !canDelete) return null;

  const run = (action: () => Promise<ServicoResult>, done: string, redirectTo?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOpen(null);
        setMotivo("");
        toast.success(done);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(t(result.error === "started" ? "startedError" : "failed"));
      }
    });

  const icon = size === "icon";
  return (
    <div className="flex shrink-0 gap-1">
      {canCancel && (
        <AlertDialog open={open === "cancel"} onOpenChange={(o) => setOpen(o ? "cancel" : null)}>
          <AlertDialogTrigger
            render={<Button variant="outline" size={icon ? "icon-lg" : "lg"} aria-label={icon ? t("cancel") : undefined} title={t("cancel")} />}
          >
            <Ban aria-hidden />
            {!icon && t("cancel")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{label}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`motivo-${id}`}>{t("reason")}</Label>
              <Textarea id={`motivo-${id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("back")}</AlertDialogCancel>
              <Button variant="destructive" disabled={pending || !motivo.trim()} onClick={() => run(() => cancelarServico(id, motivo), t("cancelled"))}>
                {t("cancel")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {canDelete && (
        <AlertDialog open={open === "delete"} onOpenChange={(o) => setOpen(o ? "delete" : null)}>
          <AlertDialogTrigger
            render={<Button variant="outline" size={icon ? "icon-lg" : "lg"} aria-label={icon ? t("delete") : undefined} title={t("delete")} />}
          >
            <Trash2 aria-hidden />
            {!icon && t("delete")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {label}. {t("deleteText")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("back")}</AlertDialogCancel>
              <Button variant="destructive" disabled={pending} onClick={() => run(() => excluirServico(id), t("deleted"), afterDelete)}>
                {t("delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
