"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FormError, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WEEK_DAYS } from "@/lib/colaboradoras";
import { saveColaboradora } from "./actions";
import { PasswordReveal } from "./password-reveal";

export function ColaboradoraForm({ initial, hasLogin = false }: { initial: Record<string, string>; hasLogin?: boolean }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(saveColaboradora, undefined);

  if (state && "created" in state) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="font-medium">{t("workers.createdTitle")}</p>
          {state.created.password && state.created.email ? (
            <PasswordReveal email={state.created.email} password={state.created.password} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("workers.createdNoLogin")}</p>
          )}
          <Button size="lg" className="self-start" render={<Link href="/admin/colaboradoras" />} nativeButton={false}>
            {t("workers.backToList")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const values = state?.values ?? initial;
  const field = (name: string) => ({ name, defaultValue: values[name] ?? "", invalid: state?.fields?.includes(name) });
  const days = new Set((values.dias_disponiveis ?? "").split(",").filter(Boolean));
  const isNew = !initial.id;
  const errorKey = state?.error === "invalid" ? "form.invalid" : state?.error ? `workers.errors.${state.error}` : null;

  return (
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("workers.sections.data")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <TextField {...field("nome")} label={t("workers.fields.nome")} required maxLength={200} className="sm:col-span-2" />
          <TextField {...field("telefone")} label={t("workers.fields.telefone")} type="tel" inputMode="tel" maxLength={40} />
          <TextField
            {...field("email")}
            label={t("workers.fields.email")}
            type="email"
            maxLength={254}
            required={hasLogin}
            hint={isNew ? t("workers.hints.emailNew") : hasLogin ? t("workers.hints.emailLogin") : undefined}
          />
          {isNew && (
            <SelectField
              {...field("idioma")}
              label={t("workers.fields.idioma")}
              options={(["es", "pt"] as const).map((v) => ({ value: v, label: t(`languages.${v}`) }))}
            />
          )}
          <TextField
            {...field("tipos_de_servico")}
            label={t("workers.fields.tipos_de_servico")}
            hint={t("workers.hints.tipos_de_servico")}
            maxLength={500}
            className={isNew ? undefined : "sm:col-span-2"}
          />
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">{t("workers.fields.dias_disponiveis")}</legend>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((d) => (
                <label key={d} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm has-checked:border-primary has-checked:bg-primary/10">
                  <input type="checkbox" name="dias_disponiveis" value={d} defaultChecked={days.has(d)} className="accent-primary" />
                  {t(`days.${d}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:max-w-md">
            <SelectField
              {...field("tipo_pagamento")}
              label={t("workers.fields.tipo_pagamento")}
              options={[{ value: "", label: "—" }, ...(["hora", "diaria", "fixo"] as const).map((v) => ({ value: v, label: t(`billing.${v}`) }))]}
            />
            <TextField {...field("valor_pagamento")} label={t("workers.fields.valor_pagamento")} inputMode="decimal" />
          </div>
          <TextAreaField {...field("observacoes")} label={t("workers.fields.observacoes")} maxLength={2000} className="sm:col-span-2" />
        </CardContent>
      </Card>

      {errorKey && <FormError>{t(errorKey)}</FormError>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="lg" render={<Link href="/admin/colaboradoras" />} nativeButton={false}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("form.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
