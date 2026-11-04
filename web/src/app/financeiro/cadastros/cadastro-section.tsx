"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FormError, SelectField, TextField } from "@/components/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Cadastro } from "@/lib/financeiro";
import { saveCadastro, setCadastroAtivo } from "../actions";

export type FieldDef = { name: string; label: string; options?: { value: string; label: string }[]; required?: boolean; editable?: boolean; wide?: boolean };
export type CadastroRow = Record<string, string | boolean | null> & { id: string; ativo: boolean };

// One auxiliary list: add new entries, edit them in place, deactivate (never delete).
export function CadastroSection({ tabela, title, fields, rows }: { tabela: Cadastro; title: string; fields: FieldDef[]; rows: CadastroRow[] }) {
  const t = useTranslations("finance");
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {adding && <RowForm tabela={tabela} fields={fields} onDone={() => setAdding(false)} />}
        {rows.length === 0 && !adding && <p className="text-sm text-muted-foreground">{t("emptyList")}</p>}
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-2">
              <RowView tabela={tabela} fields={fields} row={row} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RowView({ tabela, fields, row }: { tabela: Cadastro; fields: FieldDef[]; row: CadastroRow }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  if (editing) return <RowForm tabela={tabela} fields={fields} row={row} onDone={() => setEditing(false)} />;

  const toggle = () =>
    startTransition(async () => {
      const result = await setCadastroAtivo(tabela, row.id, !row.ativo);
      if (result.ok) router.refresh();
      else toast.error(t("errors.failed"));
    });
  const secondary = fields
    .slice(1)
    .map((f) => (f.options ? f.options.find((o) => o.value === row[f.name])?.label : row[f.name]))
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className={row.ativo ? "min-w-0" : "min-w-0 opacity-60"}>
        <p className="truncate font-medium">
          {String(row[fields[0].name] ?? "")}
          {!row.ativo && (
            <Badge variant="secondary" className="ml-2">
              {t("inactive")}
            </Badge>
          )}
        </p>
        {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={toggle}>
          {row.ativo ? t("deactivate") : t("activate")}
        </Button>
      </div>
    </div>
  );
}

function RowForm({ tabela, fields, row, onDone }: { tabela: Cadastro; fields: FieldDef[]; row?: CadastroRow; onDone: () => void }) {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveCadastro>>, formData: FormData) => {
    const result = await saveCadastro(prev, formData);
    if (!result?.error) {
      onDone();
      router.refresh();
    }
    return result;
  }, undefined);
  const value = (name: string) => state?.values?.[name] ?? (row?.[name] == null ? "" : String(row[name]));

  return (
    <form action={action} className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
      <input type="hidden" name="tabela" value={tabela} />
      {row && <input type="hidden" name="id" value={row.id} />}
      {fields.map((f) =>
        f.options && row && f.editable === false ? (
          <div key={f.name}>
            <input type="hidden" name={f.name} value={value(f.name)} />
            <SelectField name={`${f.name}_label`} label={f.label} options={f.options} defaultValue={value(f.name)} disabled />
          </div>
        ) : f.options ? (
          <SelectField
            key={f.name}
            name={f.name}
            label={f.label}
            options={f.options}
            defaultValue={value(f.name) || f.options[0]?.value}
            invalid={state?.fields?.includes(f.name)}
          />
        ) : (
          <TextField
            key={f.name}
            name={f.name}
            label={f.label}
            required={f.required}
            defaultValue={value(f.name)}
            invalid={state?.fields?.includes(f.name)}
            className={f.wide ? "sm:col-span-2" : undefined}
          />
        ),
      )}
      {state?.error && <FormError>{t(state.error === "invalid" ? "errors.invalid" : "errors.failed")}</FormError>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : tc("save")}
        </Button>
      </div>
    </form>
  );
}
