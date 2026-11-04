import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CadastroSection, type CadastroRow } from "./cadastro-section";

export default async function CadastrosPage() {
  await requireUser({ role: FIN_ROLES });
  const t = await getTranslations("finance");
  const supabase = await createClient();
  const [favorecidos, categorias, formas, contas] = await Promise.all([
    supabase.from("fin_favorecidos").select("id, nome, nif, email, telefone, observacoes, ativo").order("ativo", { ascending: false }).order("nome").limit(2000),
    supabase.from("fin_categorias").select("id, nome, natureza, ativo").order("natureza").order("nome"),
    supabase.from("fin_formas_pagamento").select("id, nome, ativo").order("nome"),
    supabase.from("fin_contas").select("id, nome, tipo, ativo").order("nome"),
  ]);
  const rows = (r: { data: unknown }) => (r.data ?? []) as CadastroRow[];

  return (
    <>
      <PageHeader title={t("registers.title")} description={t("registers.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-span-2">
          <CadastroSection
            tabela="fin_favorecidos"
            title={t("registers.payees")}
            rows={rows(favorecidos)}
            fields={[
              { name: "nome", label: t("registers.fields.nome"), required: true },
              { name: "nif", label: t("registers.fields.nif") },
              { name: "email", label: t("registers.fields.email") },
              { name: "telefone", label: t("registers.fields.telefone") },
              { name: "observacoes", label: t("registers.fields.observacoes"), wide: true },
            ]}
          />
        </div>
        <CadastroSection
          tabela="fin_categorias"
          title={t("registers.categories")}
          rows={rows(categorias)}
          fields={[
            { name: "nome", label: t("registers.fields.nome"), required: true },
            {
              name: "natureza",
              label: t("registers.fields.natureza"),
              editable: false,
              options: [
                { value: "despesa", label: t("registers.expense") },
                { value: "receita", label: t("registers.income") },
              ],
            },
          ]}
        />
        <div className="flex flex-col gap-4">
          <CadastroSection
            tabela="fin_contas"
            title={t("registers.accounts")}
            rows={rows(contas)}
            fields={[
              { name: "nome", label: t("registers.fields.nome"), required: true },
              {
                name: "tipo",
                label: t("registers.fields.tipo"),
                options: [
                  { value: "banco", label: t("registers.bank") },
                  { value: "caixa", label: t("registers.cash") },
                ],
              },
            ]}
          />
          <CadastroSection
            tabela="fin_formas_pagamento"
            title={t("registers.methods")}
            rows={rows(formas)}
            fields={[{ name: "nome", label: t("registers.fields.nome"), required: true }]}
          />
        </div>
      </div>
    </>
  );
}
