"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Ban, Paperclip, Undo2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ANEXO_ACCEPT, ANEXO_MAX_BYTES, TIPOS_ANEXO } from "@/lib/financeiro";
import { cancelarDocumento, enviarAnexo, estornarMovimento, type FinResult } from "./actions";
import { FinErrorMessage, finErrorText } from "./fin-error";

// Confirmation with a mandatory justification (cancel a document, reverse a movement).
function JustifiedAction({
  trigger,
  title,
  description,
  confirmLabel,
  run,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  run: (justificativa: string) => Promise<FinResult>;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const valid = text.trim().length >= 3;

  const confirm = () =>
    startTransition(async () => {
      const result = await run(text);
      if (result.ok) {
        setOpen(false);
        setText("");
        toast.success(t("done"));
        router.refresh();
      } else {
        toast.error(finErrorText(t, locale, result.error, result.detail));
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="justificativa">{t("fields.justificativa")}</Label>
          <Textarea id="justificativa" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} required />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("back")}</AlertDialogCancel>
          <Button variant="destructive" disabled={!valid || pending} onClick={confirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CancelDocumentButton({ documentoId }: { documentoId: string }) {
  const t = useTranslations("finance");
  return (
    <JustifiedAction
      trigger={
        <Button variant="outline" size="lg">
          <Ban aria-hidden />
          {t("cancelDocument")}
        </Button>
      }
      title={t("cancelTitle")}
      description={t("cancelText")}
      confirmLabel={t("cancelDocument")}
      run={(j) => cancelarDocumento(documentoId, j)}
    />
  );
}

export function ReverseButton({ movimentoId, documentoId }: { movimentoId: string; documentoId: string }) {
  const t = useTranslations("finance");
  return (
    <JustifiedAction
      trigger={
        <Button variant="outline" size="sm">
          <Undo2 aria-hidden />
          {t("reverse")}
        </Button>
      }
      title={t("reverseTitle")}
      description={t("reverseText")}
      confirmLabel={t("reverse")}
      run={(j) => estornarMovimento(movimentoId, documentoId, j)}
    />
  );
}

export function AttachmentUpload({ documentoId }: { documentoId: string }) {
  const t = useTranslations("finance");
  const [state, action, pending] = useActionState(enviarAnexo, undefined);
  const [tooBig, setTooBig] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="documento_id" value={documentoId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="anexo-tipo">{t("fields.tipo_anexo")}</Label>
        <NativeSelect id="anexo-tipo" name="tipo" defaultValue="fatura" className="h-10">
          {TIPOS_ANEXO.map((v) => (
            <option key={v} value={v}>
              {t(`docTypes.${v}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor="anexo-arquivo">{t("fields.arquivo")}</Label>
        <Input
          id="anexo-arquivo"
          name="arquivo"
          type="file"
          accept={ANEXO_ACCEPT}
          required
          className="h-10"
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > ANEXO_MAX_BYTES)}
        />
      </div>
      <Button type="submit" variant="outline" className="h-10" disabled={pending || tooBig}>
        <Paperclip aria-hidden />
        {pending ? t("saving") : t("attach")}
      </Button>
      {(tooBig || state?.error) && (
        <div className="sm:basis-full">
          <FinErrorMessage error={tooBig ? "arquivo_grande" : state!.error!} />
        </div>
      )}
    </form>
  );
}
