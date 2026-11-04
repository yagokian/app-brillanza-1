import "server-only";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { todayInMadrid } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

export type Option = { id: string; nome: string; ativo: boolean };
export type CategoriaOption = Option & { natureza: "receita" | "despesa" };
export type ContaOption = Option & { tipo: "banco" | "caixa" };
export type ServicoOption = { id: string; data_servico: string; cliente_nome: string; status: string };

// Every list a financial form or filter needs. Clients come through an RPC that only returns names.
export async function loadOptions() {
  const supabase = await createClient();
  const [categorias, contas, formas, favorecidos, clientes] = await Promise.all([
    supabase.from("fin_categorias").select("id, nome, natureza, ativo").order("nome"),
    supabase.from("fin_contas").select("id, nome, tipo, ativo").order("nome"),
    supabase.from("fin_formas_pagamento").select("id, nome, ativo").order("nome"),
    supabase.from("fin_favorecidos").select("id, nome, ativo").order("nome").limit(2000),
    supabase.rpc("rpc_fin_clientes"),
  ]);
  return {
    categorias: (categorias.data ?? []) as CategoriaOption[],
    contas: (contas.data ?? []) as ContaOption[],
    formas: (formas.data ?? []) as Option[],
    favorecidos: (favorecidos.data ?? []) as Option[],
    clientes: ((clientes.data ?? []) as { id: string; nome: string; anonimizado: boolean }[]).map((c) => ({
      id: c.id,
      nome: c.nome,
      ativo: !c.anonimizado,
    })),
  };
}

export async function loadServicos(params: { de?: string | null; ate?: string | null; id?: string | null }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("rpc_fin_servicos", {
    p_cliente_id: null,
    p_de: params.de ?? null,
    p_ate: params.ate ?? null,
    p_id: params.id ?? null,
  });
  return (data ?? []) as ServicoOption[];
}

// Active options plus the one already chosen (it may have been deactivated since).
export const usable = <T extends Option>(options: T[], current?: string | null) => options.filter((o) => o.ativo || o.id === current);

// Choices for the document form, keeping whatever the document already uses.
// clientSuffix tells clients apart from payees with the same name.
export async function loadFormChoices(natureza: "pagar" | "receber", locale: string, clientSuffix: string, current: Record<string, string> = {}) {
  const today = todayInMadrid();
  const [options, servicos, atual] = await Promise.all([
    loadOptions(),
    loadServicos({ de: addDays(today, -120), ate: addDays(today, 60) }),
    current.servico_id ? loadServicos({ id: current.servico_id }) : Promise.resolve([]),
  ]);
  const [kind, parteId] = [current.parte?.[0], current.parte?.slice(2)];
  const parties = [
    ...usable(options.favorecidos, kind === "f" ? parteId : null).map((f) => ({ value: `f:${f.id}`, label: f.nome })),
    ...(natureza === "receber" || kind === "c"
      ? usable(options.clientes, kind === "c" ? parteId : null).map((c) => ({ value: `c:${c.id}`, label: `${c.nome} (${clientSuffix})` }))
      : []),
  ].sort((a, b) => a.label.localeCompare(b.label, locale));
  const categorias = usable(
    options.categorias.filter((c) => c.natureza === (natureza === "pagar" ? "despesa" : "receita")),
    current.categoria_id,
  ).map((c) => ({ value: c.id, label: c.nome }));
  const servicoChoices = [...atual, ...servicos.filter((s) => s.id !== current.servico_id)].map((s) => ({
    value: s.id,
    label: `${formatDate(s.data_servico, locale)} · ${s.cliente_nome}`,
  }));
  return { parties, categorias, servicos: servicoChoices };
}
