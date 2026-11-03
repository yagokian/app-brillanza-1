"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCliente } from "./actions";

export type ClienteFormValues = Record<string, string>;

export function ClienteForm({ initial, cancelHref }: { initial: ClienteFormValues; cancelHref: string }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveCliente, undefined);
  const values = state?.values ?? initial;
  const bad = (name: string) => state?.fields?.includes(name);
  const field = (name: string) => ({ name, defaultValue: values[name] ?? "", invalid: bad(name) });

  const billing = [
    { value: "", label: "—" },
    ...(["hora", "diaria", "fixo"] as const).map((v) => ({ value: v, label: t(`billing.${v}`) })),
  ];

  return (
    // The key re-mounts the form with the values sent back after a failed save.
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <Card>
        <CardHeader>
          <CardTitle>{t("clients.sections.contact")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField {...field("nome")} label={t("clients.fields.nome")} required maxLength={200} className="sm:col-span-2" />
          <TextField {...field("telefone")} label={t("clients.fields.telefone")} type="tel" inputMode="tel" maxLength={40} />
          <TextField {...field("email")} label={t("clients.fields.email")} type="email" maxLength={254} />
          <TextField {...field("endereco")} label={t("clients.fields.endereco")} maxLength={300} className="sm:col-span-2" />
          <TextField {...field("codigo_postal")} label={t("clients.fields.codigo_postal")} inputMode="numeric" maxLength={10} />
          <TextField {...field("cidade")} label={t("clients.fields.cidade")} maxLength={100} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("clients.sections.service")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField {...field("tipo_servico")} label={t("clients.fields.tipo_servico")} maxLength={200} />
          <TextField {...field("data_contratacao")} label={t("clients.fields.data_contratacao")} type="date" />
          <TextField {...field("frequencia")} label={t("clients.fields.frequencia")} maxLength={100} />
          <TextField {...field("dia_semana")} label={t("clients.fields.dia_semana")} maxLength={100} />
          <TextField {...field("duracao_horario")} label={t("clients.fields.duracao_horario")} maxLength={100} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField {...field("tipo_cobranca")} label={t("clients.fields.tipo_cobranca")} options={billing} />
            <TextField {...field("valor_acordado")} label={t("clients.fields.valor_acordado")} inputMode="decimal" />
          </div>
          <TextAreaField
            {...field("notas_para_colaboradora")}
            label={t("clients.fields.notas_para_colaboradora")}
            hint={t("clients.hints.notas_para_colaboradora")}
            maxLength={2000}
            className="sm:col-span-2"
          />
          <TextAreaField
            {...field("observacoes")}
            label={t("clients.fields.observacoes")}
            hint={t("clients.hints.observacoes")}
            maxLength={2000}
            className="sm:col-span-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("clients.sections.privacy")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SelectField
            {...field("base_legal")}
            label={t("clients.fields.base_legal")}
            options={(["contrato", "consentimento"] as const).map((v) => ({ value: v, label: t(`legalBasis.${v}`) }))}
          />
          <TextField
            {...field("aviso_privacidade_em")}
            label={t("clients.fields.aviso_privacidade_em")}
            hint={t("clients.hints.aviso_privacidade_em")}
            type="date"
          />
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
