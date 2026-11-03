"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PasswordReveal } from "@/app/admin/colaboradoras/password-reveal";
import { FormError, SelectField, TextField } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { criarUsuarioFinanceiro, novaSenhaFinanceiro, setUsuarioAtivo } from "./actions";

export function UsuarioForm() {
  const t = useTranslations("finance.users");
  const tw = useTranslations("workers");
  const tf = useTranslations("form");
  const [state, action, pending] = useActionState(criarUsuarioFinanceiro, undefined);
  const values = state && "values" in state ? (state.values ?? {}) : {};
  const bad = (name: string) => !!state && "fields" in state && state.fields?.includes(name);

  if (state && "created" in state) return <PasswordReveal email={state.created.email} password={state.created.password} />;

  return (
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4">
      <TextField name="nome" label={t("name")} required maxLength={200} defaultValue={values.nome} invalid={bad("nome")} />
      <TextField name="email" label={t("email")} type="email" required maxLength={254} defaultValue={values.email} invalid={bad("email")} />
      <SelectField
        name="idioma"
        label={t("language")}
        defaultValue={values.idioma ?? "es"}
        options={[
          { value: "es", label: "Español" },
          { value: "pt", label: "Português" },
        ]}
      />
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {state && "error" in state && (
        <FormError>
          {state.error === "invalid" ? tf("invalid") : state.error === "failed" ? tf("failed") : tw(`errors.${state.error}`)}
        </FormError>
      )}
      <Button type="submit" size="lg" disabled={pending} className="self-end">
        {pending ? tf("saving") : t("create")}
      </Button>
    </form>
  );
}

export function UsuarioRow({ id, nome, email, ativo }: { id: string; nome: string; email: string | null; ativo: boolean }) {
  const t = useTranslations("finance.users");
  const tf = useTranslations("form");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const toggle = () =>
    startTransition(async () => {
      const result = await setUsuarioAtivo(id, !ativo);
      if (result.ok) router.refresh();
      else toast.error(tf("failed"));
    });
  const reset = () =>
    startTransition(async () => {
      const result = await novaSenhaFinanceiro(id);
      if (result.ok) setReveal({ email: result.email, password: result.password });
      else toast.error(tf("failed"));
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={ativo ? "min-w-0" : "min-w-0 opacity-60"}>
          <p className="truncate font-medium">
            {nome}
            {!ativo && (
              <Badge variant="secondary" className="ml-2">
                {t("inactive")}
              </Badge>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">{email ?? "—"}</p>
        </div>
        <div className="flex gap-1">
          {ativo && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={reset}>
              {t("resetPassword")}
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={pending} onClick={toggle}>
            {ativo ? t("deactivate") : t("activate")}
          </Button>
        </div>
      </div>
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} />}
    </div>
  );
}
