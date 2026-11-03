"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ANEXO_ACCEPT, ANEXO_MAX_BYTES, parseCents, type Natureza } from "@/lib/financeiro";
import { formatMoney } from "@/lib/format";
import { registrarMovimento } from "./actions";
import { FinErrorMessage } from "./fin-error";

type Choice = { value: string; label: string };

// Manual payment or receipt. Shows how the money moved splits into principal and interest/fine/discount.
export function MovimentoForm(props: {
  natureza: Natureza;
  documentoId: string;
  parcelaId: string;
  saldo: number;
  contas: Choice[];
  formas: Choice[];
  initial: Record<string, string>;
  today: string;
}) {
  const [state, action, pending] = useActionState(registrarMovimento, undefined);
  const values = state?.values ?? props.initial;
  return <Fields key={JSON.stringify(values)} {...props} values={values} state={state} action={action} pending={pending} />;
}

function Fields({
  natureza,
  documentoId,
  parcelaId,
  saldo,
  contas,
  formas,
  values,
  today,
  state,
  action,
  pending,
}: Parameters<typeof MovimentoForm>[0] & {
  values: Record<string, string>;
  state: Awaited<ReturnType<typeof registrarMovimento>>;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const locale = useLocale();
  const bad = (name: string) => state?.fields?.includes(name);
  const [amounts, setAmounts] = useState({
    valor: values.valor ?? "",
    juros: values.juros ?? "",
    multa: values.multa ?? "",
    desconto: values.desconto ?? "",
  });
  const [tooBig, setTooBig] = useState(false);
  const pay = natureza === "pagar";

  const cents = (v: string) => (v.trim() === "" ? 0 : parseCents(v));
  const parts = { valor: cents(amounts.valor), juros: cents(amounts.juros), multa: cents(amounts.multa), desconto: cents(amounts.desconto) };
  const numbersOk = Object.values(parts).every((v) => v != null);
  const principal = numbersOk ? parts.valor! - parts.juros! - parts.multa! + parts.desconto! : null;
  const saldoCents = Math.round(saldo * 100);
  const over = principal != null && principal > saldoCents;
  const valid = principal != null && principal > 0 && !over && parts.valor! > 0;
  const money = (c: number) => formatMoney(c / 100, locale);
  const amountField = (name: keyof typeof amounts, label: string) => (
    <TextField
      name={name}
      label={label}
      inputMode="decimal"
      placeholder="0,00"
      invalid={bad(name) || cents(amounts[name]) == null}
      value={amounts[name]}
      onChange={(e) => setAmounts({ ...amounts, [name]: e.target.value })}
    />
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="documento_id" value={documentoId} />
      <input type="hidden" name="parcela_id" value={parcelaId} />
      <input type="hidden" name="chave" value={values.chave} />

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="data_efetiva"
            label={t("fields.data_efetiva")}
            type="date"
            max={today}
            required
            defaultValue={values.data_efetiva}
            invalid={bad("data_efetiva")}
          />
          {amountField("valor", t(pay ? "fields.valor_pago" : "fields.valor_recebido"))}
          <SelectField name="conta_id" label={t("fields.conta")} required defaultValue={values.conta_id ?? contas[0]?.value} invalid={bad("conta_id")} options={contas} />
          <SelectField name="forma_id" label={t("fields.forma")} required defaultValue={values.forma_id ?? formas[0]?.value} invalid={bad("forma_id")} options={formas} />
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            {amountField("juros", t("fields.juros"))}
            {amountField("multa", t("fields.multa"))}
            {amountField("desconto", t("fields.desconto"))}
          </div>

          <div role="status" className="rounded-md bg-muted px-3 py-2 text-sm sm:col-span-2">
            {principal == null ? (
              t("errors.valor_invalido")
            ) : (
              <>
                <p>
                  {t("fields.principal")}: <strong className="tabular-nums">{money(principal)}</strong> · {t("columns.balance")}{" "}
                  <span className="tabular-nums">{money(saldoCents)}</span> → {t("remaining")}{" "}
                  <strong className="tabular-nums">{money(Math.max(saldoCents - principal, 0))}</strong>
                </p>
                {over && <p className="font-medium text-destructive">{t("errors.acima_do_saldo", { amount: money(saldoCents) })}</p>}
                {!over && principal > 0 && principal < saldoCents && <p className="text-muted-foreground">{t("partialHint")}</p>}
              </>
            )}
          </div>

          <TextAreaField name="observacao" label={t("fields.observacao")} defaultValue={values.observacao} maxLength={1000} className="sm:col-span-2" />
          <TextField
            name="comprovante"
            label={t("fields.comprovante")}
            hint={t("hints.arquivo")}
            type="file"
            accept={ANEXO_ACCEPT}
            className="sm:col-span-2"
            onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > ANEXO_MAX_BYTES)}
          />
        </CardContent>
      </Card>

      {tooBig && <FinErrorMessage error="arquivo_grande" />}
      {state?.error && <FinErrorMessage error={state.error} detail={state.detail} />}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="lg" render={<Link href={`/financeiro/documentos/${documentoId}`} />} nativeButton={false}>
          {tc("cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={pending || !valid || tooBig}>
          {pending ? t("saving") : t(pay ? "registerPayment" : "registerReceipt")}
        </Button>
      </div>
    </form>
  );
}
