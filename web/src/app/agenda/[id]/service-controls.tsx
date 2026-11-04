"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHECKLIST_ITEMS, type ServiceStatus } from "@/lib/servicos";
import { finalizarServico, iniciarServico, salvarChecklist, salvarObservacoes } from "../actions";

export function ServiceControls({
  id,
  status,
  checklist: initialChecklist,
  observacoes: initialObs,
}: {
  id: string;
  status: ServiceStatus;
  checklist: Record<string, boolean>;
  observacoes: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState(initialChecklist);
  const [obs, setObs] = useState(initialObs);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editable = status === "agendado" || status === "em_andamento";
  const done = CHECKLIST_ITEMS.filter((key) => checklist[key]).length;

  const run = (action: () => Promise<{ ok: boolean }>, success?: string, onFail?: () => void) =>
    startTransition(async () => {
      const { ok } = await action();
      if (ok) {
        if (success) toast.success(success);
        router.refresh();
      } else {
        onFail?.();
        toast.error(t("form.failed"));
      }
    });

  // Each tick saves straight away; on failure the box goes back.
  const toggle = (key: string, value: boolean) => {
    const previous = checklist;
    const next = { ...checklist, [key]: value };
    setChecklist(next);
    run(() => salvarChecklist(id, next), undefined, () => setChecklist(previous));
  };

  return (
    <div className="flex flex-col gap-4">
      {status === "agendado" && (
        <Button size="lg" className="h-12 text-base" disabled={pending} onClick={() => run(() => iniciarServico(id), t("worker.startedToast"))}>
          <Play aria-hidden />
          {t("worker.start")}
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {t("worker.checklist")}
            <span className="text-sm font-normal text-muted-foreground">
              {done}/{CHECKLIST_ITEMS.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {CHECKLIST_ITEMS.map((key) => (
              <li key={key} className="border-b last:border-b-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 has-disabled:cursor-default">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={!!checklist[key]}
                    disabled={!editable}
                    onChange={(e) => toggle(key, e.target.checked)}
                  />
                  <span className={checklist[key] ? "text-muted-foreground line-through" : undefined}>
                    {t(`worker.checklistItems.${key}`)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Label htmlFor="observacoes" className="text-base">
              {t("worker.notes")}
            </Label>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {editable ? (
            <>
              <Textarea
                id="observacoes"
                value={obs}
                maxLength={2000}
                rows={4}
                placeholder={t("worker.notesPlaceholder")}
                onChange={(e) => setObs(e.target.value)}
              />
              <Button
                variant="outline"
                size="lg"
                className="self-end"
                disabled={pending || obs === initialObs}
                onClick={() => run(() => salvarObservacoes(id, obs), t("worker.notesSaved"))}
              >
                {t("common.save")}
              </Button>
            </>
          ) : (
            <p className="text-sm whitespace-pre-line text-muted-foreground">{obs || "—"}</p>
          )}
        </CardContent>
      </Card>

      {status === "em_andamento" && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger render={<Button size="lg" className="h-12 text-base" disabled={pending} />}>
            <CheckCircle2 aria-hidden />
            {t("worker.finish")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("worker.finishTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("worker.finishText", { done, total: CHECKLIST_ITEMS.length })}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={() => {
                  setConfirmOpen(false);
                  // The notes typed so far go with the finish, saved or not.
                  run(() => finalizarServico(id, obs), t("worker.finishedToast"));
                }}
              >
                {t("worker.finish")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
