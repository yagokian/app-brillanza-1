"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { uploadAnexo } from "@/lib/anexos";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import {
  CADASTROS,
  CONDICOES,
  NATUREZAS,
  TIPOS_ANEXO,
  TIPOS_DOCUMENTO,
  centsToDecimal,
  finError,
  parseCents,
  type FinError,
} from "@/lib/financeiro";
import { formValues, invalidFields, optionalEmail, optionalText, requiredText } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

export type FinState =
  | {
      error?: FinError;
      detail?: string;
      fields?: string[];
      values?: Record<string, string>;
      duplicates?: { id: string; numero_interno: number; descricao: string; data_emissao: string; valor_total: number }[];
      warning?: "anexo";
    }
  | undefined;

export type FinResult = { ok: true } | { ok: false; error: FinError; detail?: string };

const uuid = z.uuid();
const isoDate = z.iso.date();
const money = z.preprocess((v) => parseCents(v as string), z.number().int().min(0));
const positiveMoney = z.preprocess((v) => parseCents(v as string), z.number().int().min(1));
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

const documentoSchema = z.object({
  natureza: z.enum(NATUREZAS),
  parte: z.string().regex(/^[cf]:[0-9a-f-]{36}$/),
  descricao: requiredText(300),
  tipo_documento: z.enum(TIPOS_DOCUMENTO),
  numero: optionalText(60),
  serie: optionalText(30),
  data_emissao: isoDate,
  valor_total: positiveMoney,
  categoria_id: uuid,
  condicao: z.enum(CONDICOES),
  observacoes: optionalText(2000),
  servico_id: optionalUuid,
  parcelas: z.preprocess(
    (v) => {
      try {
        return JSON.parse(String(v));
      } catch {
        return null;
      }
    },
    z.array(z.object({ valor: positiveMoney, vencimento: isoDate })).min(1).max(120),
  ),
  chave: uuid,
  justificativa: optionalText(1000),
});

const pathFor = (natureza: string) => (natureza === "receber" ? "/financeiro/receber" : "/financeiro/pagar");

function revalidateFin(documentoId?: string) {
  revalidatePath("/financeiro", "layout");
  if (documentoId) revalidatePath(`/financeiro/documentos/${documentoId}`);
}

// New or edited document with its installments (one transaction in the database).
export async function saveDocumento(_prev: FinState, formData: FormData): Promise<FinState> {
  await requireUser({ role: FIN_ROLES });
  const values = formValues(formData);
  const parsed = documentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };
  const input = parsed.data;

  const sum = input.parcelas.reduce((total, p) => total + p.valor, 0);
  if (sum !== input.valor_total) return { error: "soma_parcelas", detail: centsToDecimal(sum), fields: ["parcelas"], values };
  if ((input.condicao === "parcelado") !== input.parcelas.length >= 2) return { error: "invalid", fields: ["condicao"], values };

  const [kind, parteId] = [input.parte[0], input.parte.slice(2)];
  const rawId = formData.get("id");
  const id = rawId ? uuid.safeParse(rawId) : null;
  if (id && !id.success) return { error: "failed", values };
  const supabase = await createClient();

  // Possible duplicate: same party + document type + number + series. A warning, never a block.
  if (input.numero && formData.get("confirmar_duplicado") !== "1") {
    let query = supabase
      .from("fin_documentos")
      .select("id, numero_interno, descricao, data_emissao, valor_total")
      .eq("natureza", input.natureza)
      .eq("tipo_documento", input.tipo_documento)
      .ilike("numero", input.numero.replace(/[\\%_]/g, (c) => `\\${c}`))
      .eq(kind === "c" ? "cliente_id" : "favorecido_id", parteId)
      .eq("situacao", "ativo")
      .limit(5);
    query = input.serie ? query.ilike("serie", input.serie.replace(/[\\%_]/g, (c) => `\\${c}`)) : query.is("serie", null);
    if (id?.success) query = query.neq("id", id.data);
    const { data: duplicates } = await query;
    if (duplicates?.length) return { duplicates, values };
  }

  const dados = {
    natureza: input.natureza,
    cliente_id: kind === "c" ? parteId : null,
    favorecido_id: kind === "f" ? parteId : null,
    descricao: input.descricao,
    tipo_documento: input.tipo_documento,
    numero: input.numero,
    serie: input.serie,
    data_emissao: input.data_emissao,
    valor_total: centsToDecimal(input.valor_total),
    categoria_id: input.categoria_id,
    condicao: input.condicao,
    observacoes: input.observacoes,
    servico_id: input.servico_id,
  };
  const parcelas = input.parcelas.map((p) => ({ valor: centsToDecimal(p.valor), vencimento: p.vencimento }));

  let documentoId: string;
  if (id?.success) {
    const { data, error } = await supabase.rpc("rpc_fin_editar_documento", {
      p_id: id.data,
      p_dados: dados,
      p_parcelas: parcelas,
      p_justificativa: input.justificativa ?? "",
    });
    if (error || !data) return { ...finError(error), values };
    documentoId = id.data;
  } else {
    const { data, error } = await supabase.rpc("rpc_fin_criar_documento", { p_dados: dados, p_parcelas: parcelas, p_chave: input.chave });
    if (error || !data) return { ...finError(error), values };
    documentoId = data as string;
  }

  revalidateFin(documentoId);
  revalidatePath(pathFor(input.natureza));
  redirect(`/financeiro/documentos/${documentoId}`);
}

const movimentoSchema = z.object({
  documento_id: uuid,
  parcela_id: uuid,
  data_efetiva: isoDate,
  valor: money,
  juros: z.preprocess((v) => (v === "" || v == null ? "0" : v), money),
  multa: z.preprocess((v) => (v === "" || v == null ? "0" : v), money),
  desconto: z.preprocess((v) => (v === "" || v == null ? "0" : v), money),
  conta_id: uuid,
  forma_id: uuid,
  observacao: optionalText(1000),
  chave: uuid,
});

// Manual payment/receipt of one installment. The proof of payment is optional and attached afterwards.
export async function registrarMovimento(_prev: FinState, formData: FormData): Promise<FinState> {
  await requireUser({ role: FIN_ROLES });
  const values = formValues(formData);
  const parsed = movimentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };
  const input = parsed.data;
  const principal = input.valor - input.juros - input.multa + input.desconto;
  if (principal <= 0) return { error: "valor_invalido", fields: ["valor"], values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_fin_registrar_movimento", {
    p_parcela_id: input.parcela_id,
    p_data: input.data_efetiva,
    p_valor: centsToDecimal(input.valor),
    p_juros: centsToDecimal(input.juros),
    p_multa: centsToDecimal(input.multa),
    p_desconto: centsToDecimal(input.desconto),
    p_conta_id: input.conta_id,
    p_forma_id: input.forma_id,
    p_observacao: input.observacao ?? "",
    p_chave: input.chave,
  });
  if (error || !data) return { ...finError(error), values };

  const file = formData.get("comprovante");
  let query = "registrado=1";
  if (file instanceof File && file.size > 0) {
    const upload = await uploadAnexo(supabase, file, { documentoId: input.documento_id, movimentoId: data as string, tipo: "comprovante" });
    if (!upload.ok) query = "registrado=1&anexo=erro";
  }
  revalidateFin(input.documento_id);
  redirect(`/financeiro/documentos/${input.documento_id}?${query}`);
}

const justificativa = z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().min(3).max(1000));

export async function estornarMovimento(movimentoId: string, documentoId: string, texto: string): Promise<FinResult> {
  await requireUser({ role: FIN_ROLES });
  const just = justificativa.safeParse(texto);
  if (!just.success) return { ok: false, error: "justificativa_obrigatoria" };
  if (!uuid.safeParse(movimentoId).success || !uuid.safeParse(documentoId).success) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rpc_fin_estornar_movimento", { p_movimento_id: movimentoId, p_justificativa: just.data });
  if (error) return { ok: false, ...finError(error) };
  revalidateFin(documentoId);
  return { ok: true };
}

export async function cancelarDocumento(documentoId: string, texto: string): Promise<FinResult> {
  await requireUser({ role: FIN_ROLES });
  const just = justificativa.safeParse(texto);
  if (!just.success) return { ok: false, error: "justificativa_obrigatoria" };
  if (!uuid.safeParse(documentoId).success) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_fin_cancelar_documento", { p_id: documentoId, p_justificativa: just.data });
  if (error || !data) return { ok: false, ...finError(error) };
  revalidateFin(documentoId);
  return { ok: true };
}

export async function enviarAnexo(_prev: FinState, formData: FormData): Promise<FinState> {
  await requireUser({ role: FIN_ROLES });
  const documentoId = uuid.safeParse(formData.get("documento_id"));
  const tipo = z.enum(TIPOS_ANEXO).safeParse(formData.get("tipo"));
  const file = formData.get("arquivo");
  if (!documentoId.success || !tipo.success || !(file instanceof File) || file.size === 0) return { error: "arquivo_invalido" };
  const supabase = await createClient();
  const result = await uploadAnexo(supabase, file, { documentoId: documentoId.data, tipo: tipo.data });
  if (!result.ok) return { error: result.error };
  revalidateFin(documentoId.data);
  return {};
}

// ---------------------------------------------------------------------
// Auxiliary records: created and edited directly (RLS), only ever deactivated.
// ---------------------------------------------------------------------

const cadastroSchemas = {
  fin_favorecidos: z.object({
    nome: requiredText(200),
    nif: optionalText(30),
    email: optionalEmail,
    telefone: optionalText(40),
    observacoes: optionalText(2000),
  }),
  fin_categorias: z.object({ nome: requiredText(100), natureza: z.enum(["receita", "despesa"]) }),
  fin_formas_pagamento: z.object({ nome: requiredText(100) }),
  fin_contas: z.object({ nome: requiredText(100), tipo: z.enum(["banco", "caixa"]) }),
};

export async function saveCadastro(_prev: FinState, formData: FormData): Promise<FinState> {
  await requireUser({ role: FIN_ROLES });
  const values = formValues(formData);
  const tabela = z.enum(CADASTROS).safeParse(formData.get("tabela"));
  if (!tabela.success) return { error: "failed", values };
  const parsed = cadastroSchemas[tabela.data].safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };

  const supabase = await createClient();
  const rawId = formData.get("id");
  if (rawId) {
    const id = uuid.safeParse(rawId);
    if (!id.success) return { error: "failed", values };
    // The nature of a category never changes: documents already use it.
    const changes: Record<string, unknown> = { ...parsed.data };
    if (tabela.data === "fin_categorias") delete changes.natureza;
    const { error } = await supabase.from(tabela.data).update(changes).eq("id", id.data);
    if (error) return { error: "failed", values };
  } else {
    const { error } = await supabase.from(tabela.data).insert(parsed.data);
    if (error) return { error: "failed", values };
  }
  revalidatePath("/financeiro/cadastros");
  return {};
}

export async function setCadastroAtivo(tabela: string, id: string, ativo: boolean): Promise<{ ok: boolean }> {
  await requireUser({ role: FIN_ROLES });
  const t = z.enum(CADASTROS).safeParse(tabela);
  if (!t.success || !uuid.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from(t.data).update({ ativo: !!ativo }).eq("id", id);
  revalidatePath("/financeiro/cadastros");
  return { ok: !error };
}
