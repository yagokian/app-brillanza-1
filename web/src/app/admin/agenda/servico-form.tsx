"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormError, SelectField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/lib/dates";
import { SERVICE_STATUSES } from "@/lib/servicos";
import { saveServico } from "./actions";

// Defaults copied into the service when a client or colaboradora is picked.
export type Option = { id: string; nome: string; tipo: string | null; valor: string | null };

const DURATIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 30);

export function ServicoForm({
  initial,
  clientes,
  colaboradoras,
  cancelHref,
}: {
  initial: Record<string, string>;
  clientes: Option[];
  colaboradoras: Option[];
  cancelHref: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveServico, undefined);
  const values = state?.values ?? initial;
  const field = (name: string) => ({ name, defaultValue: values[name] ?? "", invalid: state?.fields?.includes(name) });

  // Money fields are controlled so picking a client or colaboradora can fill them in.
  const [money, setMoney] = useState(() => ({
    tipo_cobranca_cliente: values.tipo_cobranca_cliente ?? "",
    valor_cliente: values.valor_cliente ?? "",
    tipo_pagamento_colaboradora: values.tipo_pagamento_colaboradora ?? "",
    valor_colaboradora: values.valor_colaboradora ?? "",
  }));
  const [status, setStatus] = useState(values.status ?? "agendado");

  const billing = [{ value: "", label: "—" }, ...(["hora", "diaria", "fixo"] as const).map((v) => ({ value: v, label: t(`billing.${v}`) }))];
  const prefill = (list: Option[], id: string, tipoKey: keyof typeof money, valorKey: keyof typeof money) => {
    const option = list.find((o) => o.id === id);
    if (!option) return;
    setMoney((m) => ({ ...m, [tipoKey]: option.tipo ?? m[tipoKey], [valorKey]: option.valor ?? m[valorKey] }));
  };
  const moneyField = (name: keyof typeof money) => ({
    name,
    value: money[name],
    invalid: state?.fields?.includes(name),
    onChange: (e: { target: { value: string } }) => setMoney((m) => ({ ...m, [name]: e.target.value })),
  });

  return (
    // The key re-mounts the inputs with the values sent back after a failed save.
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("schedule.sections.service")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SelectField
            {...field("cliente_id")}
            label={t("schedule.fields.cliente")}
            required
            options={[{ value: "", label: t("schedule.pick") }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            onChange={(e) => prefill(clientes, e.target.value, "tipo_cobranca_cliente", "valor_cliente")}
          />
          <SelectField
            {...field("colaboradora_id")}
            label={t("schedule.fields.colaboradora")}
            options={[{ value: "", label: t("schedule.unassigned") }, ...colaboradoras.map((c) => ({ value: c.id, label: c.nome }))]}
            onChange={(e) => prefill(colaboradoras, e.target.value, "tipo_pagamento_colaboradora", "valor_colaboradora")}
          />
          <TextField {...field("data_servico")} label={t("schedule.fields.data")} type="date" required />
          <div className="grid grid-cols-2 gap-4">
            <TextField {...field("hora_inicio_prevista")} label={t("schedule.fields.hora")} type="time" step={900} />
            <SelectField
              {...field("duracao_minutos")}
              label={t("schedule.fields.duracao")}
              options={[{ value: "", label: "—" }, ...DURATIONS.map((m) => ({ value: String(m), label: formatMinutes(m) }))]}
            />
          </div>
          <SelectField
            {...field("status")}
            label={t("schedule.fields.status")}
            options={SERVICE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            onChange={(e) => setStatus(e.target.value)}
          />
          {status === "cancelado" && (
            <TextField {...field("motivo_cancelamento")} label={t("schedule.fields.motivo_cancelamento")} maxLength={500} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("schedule.sections.values")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <SelectField {...moneyField("tipo_cobranca_cliente")} label={t("schedule.fields.tipo_cobranca_cliente")} options={billing} />
            <TextField {...moneyField("valor_cliente")} label={t("schedule.fields.valor_cliente")} inputMode="decimal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField {...moneyField("tipo_pagamento_colaboradora")} label={t("schedule.fields.tipo_pagamento_colaboradora")} options={billing} />
            <TextField {...moneyField("valor_colaboradora")} label={t("schedule.fields.valor_colaboradora")} inputMode="decimal" />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("schedule.valuesHint")}</p>
        </CardContent>
      </Card>

      {state?.error && <FormError>{t(state.error === "invalid" ? "form.invalid" : "form.failed")}</FormError>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="lg" render={<Link href={cancelHref} />} nativeButton={false}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("form.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
