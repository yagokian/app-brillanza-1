import "server-only";
import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { EMPRESA } from "@/lib/empresa";
import { personTable, type PersonKind } from "@/lib/rgpd";
import { createClient } from "@/lib/supabase/server";


// Services of the person, without other people's data (no names of the other party,
// and the client never sees what the colaboradora is paid, nor the reverse).
const serviceColumns: Record<PersonKind, string> = {
  cliente:
    "id, data_servico, hora_inicio_prevista, duracao_estimada, status, tipo_cobranca_cliente, valor_cliente, motivo_cancelamento, hora_inicio_real, hora_fim_real, observacoes_colaboradora",
  colaboradora:
    "id, data_servico, hora_inicio_prevista, duracao_estimada, status, tipo_pagamento_colaboradora, valor_colaboradora, motivo_cancelamento, checklist, hora_inicio_real, hora_fim_real, observacoes_colaboradora",
};
const serviceKey: Record<PersonKind, string> = { cliente: "cliente_id", colaboradora: "colaboradora_id" };

type Row = Record<string, unknown>;
const PAGE = 1000;

const params = z.object({ id: z.uuid(), formato: z.enum(["json", "csv"]) });

// Right of access and portability (art. 15 and 20 RGPD). Caller must have run requireUser({ role: "admin" }).
// Every export is written to the audit log before any data leaves the server.
export async function exportPerson(kind: PersonKind, rawId: string, rawFormato: string | null) {
  const parsed = params.safeParse({ id: rawId, formato: rawFormato });
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { id, formato } = parsed.data;
  const supabase = await createClient();

  const { data: person } = await supabase.from(personTable[kind]).select("*").eq("id", id).maybeSingle();
  if (!person) return new Response("Not found", { status: 404 });

  const servicos: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("servicos")
      .select(serviceColumns[kind])
      .eq(serviceKey[kind], id)
      .order("data_servico")
      .range(from, from + PAGE - 1);
    if (error) return new Response("Error", { status: 500 });
    servicos.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < PAGE) break;
  }

  let conta: Row | null = null;
  if (kind === "colaboradora" && person.user_id) {
    const { data } = await supabase.from("profiles").select("idioma, ativo, created_at").eq("id", person.user_id).maybeSingle();
    conta = data;
  }

  const { data: logged, error: logError } = await supabase.rpc("rpc_admin_registrar_exportacao", {
    p_tabela: personTable[kind],
    p_id: id,
    p_formato: formato,
  });
  if (logError || logged !== true) return new Response("Error", { status: 500 });

  const exportadoEm = new Date().toISOString();
  const filename = `${kind}_${id.slice(0, 8)}_${exportadoEm.slice(0, 10)}.${formato}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (formato === "json") {
    const body = { responsavel: EMPRESA.nome, exportado_em: exportadoEm, tipo: kind, dados: person, conta_de_acesso: conta, servicos };
    return new Response(JSON.stringify(body, null, 2), { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  }

  // CSV: the person's fields as "campo;valor", a blank line, then one row per service.
  const text = (value: unknown) =>
    value == null ? null : typeof value === "object" ? JSON.stringify(value) : String(value);
  const columns = serviceColumns[kind].split(", ");
  const rows = [
    ["campo", "valor"],
    ...Object.entries({ ...person, ...(conta ? Object.fromEntries(Object.entries(conta).map(([k, v]) => [`conta_${k}`, v])) : {}) }).map(
      ([key, value]) => [key, Array.isArray(value) ? value.join(", ") : text(value)],
    ),
    [],
    columns,
    ...servicos.map((s) => columns.map((c) => text(s[c]))),
  ];
  return new Response(toCsv(rows), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
