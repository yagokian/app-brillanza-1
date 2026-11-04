"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PasswordReveal } from "@/app/admin/colaboradoras/password-reveal";
import { FormError, SelectField, TextField } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { criarUsuario, novaSenhaUsuario, setUsuarioAtivo } from "./actions";

export function UsuarioForm() {
  const t = useTranslations("finance.users");
  const tw = useTranslations("workers");
  const tf = useTranslations("form");
  const [state, action, pending] = useActionState(criarUsuario, undefined);
  const values = state && "values" in state ? (state.values ?? {}) : {};
  const bad = (name: string) => !!state && "fields" in state && state.fields?.includes(name);
  const [tipo, setTipo] = useState(values.tipo ?? "financeiro");
  const [confirmed, setConfirmed] = useState(false);

  if (state && "created" in state) return <PasswordReveal email={state.created.email} password={state.created.password} />;

  return (
    <form key={JSON.stringify(values)} action={action} className="flex flex-col gap-4">
      <TextField name="nome" label={t("name")} required maxLength={200} defaultValue={values.nome} invalid={bad("nome")} />
      <TextField name="email" label={t("email")} type="email" required maxLength={254} defaultValue={values.email} invalid={bad("email")} />
      <SelectField
        name="tipo"
        label={t("role")}
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value);
          setConfirmed(false);
        }}
        options={[
          { value: "financeiro", label: t("roles.financeiro") },
          { value: "admin", label: t("roles.admin") },
        ]}
      />
      <SelectField
        name="idioma"
        label={t("language")}
        defaultValue={values.idioma ?? "es"}
        options={[
          { value: "es", label: "Español" },
          { value: "pt", label: "Português" },
        ]}
      />
      {tipo === "admin" ? (
        <label className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm">
          <input type="checkbox" name="confirmar_admin" value="1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4" />
          <span>
            <span className="flex items-center gap-1 font-medium">
              <ShieldAlert className="size-4" aria-hidden />
              {t("adminWarningTitle")}
            </span>
            {t("adminWarning")}
          </span>
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">{t("roleHints.financeiro")}</p>
      )}
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {state && "error" in state && (
        <FormError>
          {state.error === "invalid" ? tf("invalid") : state.error === "failed" ? tf("failed") : tw(`errors.${state.error}`)}
        </FormError>
      )}
      <Button type="submit" size="lg" disabled={pending || (tipo === "admin" && !confirmed)} className="self-end">
        {pending ? tf("saving") : t("create")}
      </Button>
    </form>
  );
}

export function UsuarioRow({
  id,
  nome,
  email,
  ativo,
  tipo,
  self,
}: {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  tipo: "admin" | "financeiro";
  self: boolean;
}) {
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
      const result = await novaSenhaUsuario(id);
      if (result.ok) setReveal({ email: result.email, password: result.password });
      else toast.error(tf("failed"));
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={ativo ? "min-w-0" : "min-w-0 opacity-60"}>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{nome}</span>
            <Badge variant={tipo === "admin" ? "default" : "outline"}>{t(`roles.${tipo}`)}</Badge>
            {self && <Badge variant="secondary">{t("you")}</Badge>}
            {!ativo && <Badge variant="secondary">{t("inactive")}</Badge>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{email ?? "—"}</p>
        </div>
        {/* Your own access is managed by another admin, so it cannot be locked out by mistake. */}
        {!self && (
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
        )}
      </div>
      {reveal && <PasswordReveal email={reveal.email} password={reveal.password} />}
    </div>
  );
}
