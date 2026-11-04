"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Lock } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDICOES, TIPOS_DOCUMENTO, centsToDecimal, parseCents, splitInstallments, type Condicao, type Natureza } from "@/lib/financeiro";
import { formatDate, formatMoney } from "@/lib/format";
import { saveDocumento, type FinState } from "./actions";
import { FinErrorMessage } from "./fin-error";

type Choice = { value: string; label: string };
type Row = { valor: string; vencimento: string };

export type DocumentoFormProps = {
  natureza: Natureza;
  initial: Record<string, string>;
  parties: Choice[];
  categorias: Choice[];
  servicos: Choice[];
  // The document already has payments: amounts and installments are locked.
  locked?: boolean;
  cancelHref: string;
};

export function DocumentoForm(props: DocumentoFormProps) {
  const [state, action, pending] = useActionState(saveDocumento, undefined);
  const values = state?.values ?? props.initial;
  // Re-mount with the values sent back after a failed save.
  return <Fields key={JSON.stringify(values)} {...props} values={values} state={state} action={action} pending={pending} />;
}

function readRows(raw: string | undefined): Row[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.map((r) => ({ valor: String(r.valor ?? ""), vencimento: String(r.vencimento ?? "") })) : [];
  } catch {
    return [];
  }
}

function Fields({
  natureza,
  parties,
  categorias,
  servicos,
  locked,
  cancelHref,
  values,
  state,
  action,
  pending,
}: DocumentoFormProps & { values: Record<string, string>; state: FinState; action: (formData: FormData) => void; pending: boolean }) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const locale = useLocale();
  const bad = (name: string) => state?.fields?.includes(name);
  const field = (name: string) => ({ name, defaultValue: values[name] ?? "", invalid: bad(name) });
  const pay = natureza === "pagar";

  const [total, setTotal] = useState(values.valor_total ?? "");
  const [condicao, setCondicao] = useState<Condicao>((values.condicao as Condicao) || "a_vista");
  const [emissao, setEmissao] = useState(values.data_emissao ?? "");
  const [rows, setRows] = useState<Row[]>(() => readRows(values.parcelas));
  const [count, setCount] = useState(String(Math.max(rows.length, 1)));
  const [firstDue, setFirstDue] = useState(rows[0]?.vencimento || values.data_emissao || "");
  const [review, setReview] = useState(false);

  const totalCents = parseCents(total);
  const sumCents = rows.reduce((acc, r) => acc + (parseCents(r.valor) ?? NaN), 0);
  const matches = totalCents != null && totalCents > 0 && sumCents === totalCents && rows.every((r) => r.vencimento);

  // Recreates the installments from the total, the count and the first due date.
  const regenerate = (next: { total?: string; condicao?: Condicao; count?: string; firstDue?: string; emissao?: string }) => {
    if (locked) return;
    const c = next.condicao ?? condicao;
    const cents = parseCents(next.total ?? total);
    const due = c === "a_vista" ? (next.emissao ?? emissao) : (next.firstDue ?? firstDue);
    const n = c === "parcelado" ? Math.max(2, Number(next.count ?? count) || 2) : 1;
    if (cents == null || cents <= 0 || !due) return;
    setRows(splitInstallments(cents, n, due).map((r) => ({ valor: centsToDecimal(r.cents), vencimento: r.vencimento })));
  };

  const rounding = rows.length > 1 && rows[rows.length - 1].valor !== rows[0].valor;
  const money = (cents: number) => formatMoney(cents / 100, locale);
  const partyLabel = parties.find((p) => p.value === values.parte)?.label;

  return (
    <form id="doc-form" action={action} className="flex flex-col gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="natureza" value={natureza} />
      <input type="hidden" name="chave" value={values.chave} />
      <input type="hidden" name="parcelas" value={JSON.stringify(rows)} />
      {locked && (
        <>
          <input type="hidden" name="parte" value={values.parte} />
          <input type="hidden" name="valor_total" value={total} />
          <input type="hidden" name="condicao" value={condicao} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.document")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {locked ? (
            <TextField name="parte_label" label={t(pay ? "fields.payee" : "fields.party")} defaultValue={partyLabel ?? ""} disabled />
          ) : (
            <SelectField
              {...field("parte")}
              label={t(pay ? "fields.payee" : "fields.party")}
              hint={t(pay ? "hints.payee" : "hints.party")}
              required
              options={[{ value: "", label: "—" }, ...parties]}
            />
          )}
          <SelectField {...field("categoria_id")} label={t("fields.categoria")} required options={[{ value: "", label: "—" }, ...categorias]} />
          <TextField {...field("descricao")} label={t("fields.descricao")} required maxLength={300} className="sm:col-span-2" />
          <SelectField
            {...field("tipo_documento")}
            label={t("fields.tipo_documento")}
            hint={t("hints.tipo_documento")}
            options={TIPOS_DOCUMENTO.map((v) => ({ value: v, label: t(`docTypes.${v}`) }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField {...field("numero")} label={t("fields.numero")} maxLength={60} />
            <TextField {...field("serie")} label={t("fields.serie")} maxLength={30} />
          </div>
          <TextField
            name="data_emissao"
            label={t("fields.data_emissao")}
            type="date"
            required
            invalid={bad("data_emissao")}
            value={emissao}
            onChange={(e) => {
              setEmissao(e.target.value);
              if (condicao === "a_vista") regenerate({ emissao: e.target.value });
            }}
          />
          <SelectField
            {...field("servico_id")}
            label={t("fields.servico")}
            hint={t("hints.servico")}
            options={[{ value: "", label: t("noService") }, ...servicos]}
          />
          <TextAreaField {...field("observacoes")} label={t("fields.observacoes")} maxLength={2000} className="sm:col-span-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("sections.installments")}
            {locked && <Lock className="size-4 text-muted-foreground" aria-label={t("lockedShort")} />}
          </CardTitle>
          {locked && <p className="text-sm text-muted-foreground">{t("lockedHint")}</p>}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField
              name={locked ? "valor_total_label" : "valor_total"}
              label={t("fields.valor_total")}
              inputMode="decimal"
              required
              disabled={locked}
              invalid={bad("valor_total")}
              value={total}
              placeholder="0,00"
              onChange={(e) => {
                setTotal(e.target.value);
                regenerate({ total: e.target.value });
              }}
            />
            <SelectField
              name={locked ? "condicao_label" : "condicao"}
              label={t("fields.condicao")}
              disabled={locked}
              invalid={bad("condicao")}
              value={condicao}
              onChange={(e) => {
                const c = e.target.value as Condicao;
                setCondicao(c);
                const nextCount = c === "parcelado" ? String(Math.max(2, Number(count) || 2)) : "1";
                setCount(nextCount);
                regenerate({ condicao: c, count: nextCount });
              }}
              options={CONDICOES.map((v) => ({ value: v, label: t(`conditions.${v}`) }))}
            />
            {condicao === "parcelado" && (
              <TextField
                name="num_parcelas"
                label={t("fields.num_parcelas")}
                type="number"
                min={2}
                max={120}
                disabled={locked}
                value={count}
                onChange={(e) => {
                  setCount(e.target.value);
                  regenerate({ count: e.target.value });
                }}
              />
            )}
            {condicao !== "a_vista" && !locked && (
              <TextField
                name="primeiro_vencimento"
                label={t(condicao === "parcelado" ? "fields.primeiro_vencimento" : "fields.vencimento")}
                type="date"
                value={firstDue}
                onChange={(e) => {
                  setFirstDue(e.target.value);
                  regenerate({ firstDue: e.target.value });
                }}
              />
            )}
          </div>

          {rows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("reviewInstallments")}</p>
              <ol className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <li key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-2">
                    <span className="text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                    <Label className="sr-only" htmlFor={`parcela-valor-${i}`}>
                      {t("fields.valor_parcela", { n: i + 1 })}
                    </Label>
                    <Input
                      id={`parcela-valor-${i}`}
                      inputMode="decimal"
                      className="h-10"
                      disabled={locked}
                      value={row.valor}
                      aria-invalid={parseCents(row.valor) == null || undefined}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, valor: e.target.value } : r)))}
                    />
                    <Label className="sr-only" htmlFor={`parcela-venc-${i}`}>
                      {t("fields.vencimento_parcela", { n: i + 1 })}
                    </Label>
                    <Input
                      id={`parcela-venc-${i}`}
                      type="date"
                      className="h-10"
                      value={row.vencimento}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, vencimento: e.target.value } : r)))}
                    />
                  </li>
                ))}
              </ol>
              <p role="status" className={matches ? "text-sm text-muted-foreground" : "text-sm font-medium text-destructive"}>
                {Number.isNaN(sumCents)
                  ? t("sumInvalid")
                  : matches
                    ? t("sumOk", { sum: money(sumCents) })
                    : t("sumMismatch", { sum: money(sumCents), total: money(totalCents ?? 0), diff: money((totalCents ?? 0) - sumCents) })}
              </p>
              {rounding && !locked && <p className="text-xs text-muted-foreground">{t("roundingHint")}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {values.id && (
        <Card>
          <CardContent>
            <TextAreaField
              {...field("justificativa")}
              label={t("fields.justificativa")}
              hint={t(locked ? "hints.justificativaRequired" : "hints.justificativa")}
              required={locked}
              maxLength={1000}
            />
          </CardContent>
        </Card>
      )}

      {state?.duplicates && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-status-em-andamento/15 px-3 py-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {t("duplicateTitle")}
          </p>
          <ul className="list-disc pl-5">
            {state.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/financeiro/documentos/${d.id}`} target="_blank" className="underline">
                  {d.descricao}
                </Link>{" "}
                · {formatDate(d.data_emissao, locale)} · {formatMoney(d.valor_total, locale)}
              </li>
            ))}
          </ul>
          <p>{t("duplicateText")}</p>
          <Button type="submit" name="confirmar_duplicado" value="1" variant="outline" className="self-start" disabled={pending}>
            {t("saveAnyway")}
          </Button>
        </div>
      )}

      {state?.error && <FinErrorMessage error={state.error} detail={state.detail} />}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="lg" render={<Link href={cancelHref} />} nativeButton={false}>
          {tc("cancel")}
        </Button>
        <Button type="button" size="lg" disabled={pending || !matches} onClick={() => setReview(true)}>
          {t("reviewAndConfirm")}
        </Button>
      </div>

      <AlertDialog open={review} onOpenChange={setReview}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("reviewTitle")}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {t(pay ? "toPay" : "toReceive")}: <strong className="tabular-nums">{money(totalCents ?? 0)}</strong> · {t(`conditions.${condicao}`)}
            </p>
            <ol className="flex max-h-60 flex-col gap-1 overflow-y-auto">
              {rows.map((r, i) => (
                <li key={i} className="flex justify-between gap-2 tabular-nums">
                  <span>
                    {i + 1}. {formatDate(r.vencimento, locale)}
                  </span>
                  <span>{money(parseCents(r.valor) ?? 0)}</span>
                </li>
              ))}
            </ol>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setReview(false)}>
              {t("back")}
            </Button>
            <Button type="submit" form="doc-form" disabled={pending} onClick={() => setTimeout(() => setReview(false))}>
              {pending ? t("saving") : t("confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
