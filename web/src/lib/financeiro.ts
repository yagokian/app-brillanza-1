// Financial module: shared by server and client components.
import { addDays } from "@/lib/dates";

export const NATUREZAS = ["pagar", "receber"] as const;
export type Natureza = (typeof NATUREZAS)[number];

export const TIPOS_DOCUMENTO = ["nota_fiscal", "fatura", "boleto", "recibo", "contrato", "outro", "sem_documento"] as const;
export const TIPOS_ANEXO = ["nota_fiscal", "fatura", "boleto", "recibo", "contrato", "comprovante", "outro"] as const;
export const CONDICOES = ["a_vista", "a_prazo", "parcelado"] as const;
export type Condicao = (typeof CONDICOES)[number];

export const SITUACOES_LIQUIDACAO = ["aberta", "parcial", "quitada", "cancelada"] as const;
export type SituacaoLiquidacao = (typeof SITUACOES_LIQUIDACAO)[number];
export const SITUACOES_VENCIMENTO = ["vencida", "vence_hoje", "a_vencer"] as const;
export type SituacaoVencimento = (typeof SITUACOES_VENCIMENTO)[number];
export const FILTRO_SITUACOES = ["em_aberto", ...SITUACOES_VENCIMENTO, ...SITUACOES_LIQUIDACAO] as const;
export const PERIODOS = ["vencimento", "emissao", "liquidacao"] as const;

export const CADASTROS = ["fin_favorecidos", "fin_categorias", "fin_formas_pagamento", "fin_contas"] as const;
export type Cadastro = (typeof CADASTROS)[number];

// Attachments: PDF and images, up to 4 MB. Uploads go through Server Actions and Vercel
// rejects request bodies over 4.5 MB (the storage bucket itself accepts up to 8 MB).
export const ANEXO_MAX_BYTES = 4 * 1024 * 1024;
export const ANEXO_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

// Row returned by rpc_fin_listar_parcelas.
export type ParcelaRow = {
  parcela_id: string;
  documento_id: string;
  numero_interno: number;
  natureza: Natureza;
  parte_tipo: "cliente" | "favorecido";
  parte_id: string;
  parte_nome: string;
  descricao: string;
  tipo_documento: string;
  numero_documento: string | null;
  serie: string | null;
  categoria_id: string;
  categoria_nome: string;
  data_emissao: string;
  servico_id: string | null;
  documento_situacao: "ativo" | "cancelado";
  parcela_numero: number;
  num_parcelas: number;
  vencimento: string;
  valor: number;
  valor_liquidado: number;
  saldo: number;
  total_movimentado: number;
  ultima_liquidacao: string | null;
  situacao_liquidacao: SituacaoLiquidacao;
  situacao_vencimento: SituacaoVencimento | null;
};

export const docCode = (numero: number) => `#${String(numero).padStart(5, "0")}`;

// Money typed by people: "12,5", "12.50", "1.234,56" -> cents. More than 2 decimals is invalid (no silent rounding).
export function parseCents(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let text = String(raw).trim().replace(/\s|€/g, "");
  if (text === "") return null;
  if (/,\d{1,2}$/.test(text) || (text.includes(",") && !text.includes("."))) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [int, dec = ""] = text.split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents < 1e12 ? cents : null;
}

// Cents -> "123.45", the exact decimal string sent to the database.
export const centsToDecimal = (cents: number) => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

// Same calendar day k months later, clamped to the end of shorter months (31 Jan + 1 = 28/29 Feb).
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

// Equal installments in whole cents; the rounding difference goes to the last one.
export function splitInstallments(totalCents: number, count: number, firstDue: string, everyDays?: number) {
  const n = Math.max(1, Math.min(120, Math.floor(count)));
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => ({
    cents: i === n - 1 ? totalCents - base * (n - 1) : base,
    vencimento: everyDays ? addDays(firstDue, i * everyDays) : addMonths(firstDue, i),
  }));
}

// Error codes raised by the rpc_fin_* functions; anything else shows the generic error.
export const FIN_ERRORS = [
  "acima_do_saldo",
  "soma_parcelas",
  "valor_invalido",
  "parcelas_invalidas",
  "parte_invalida",
  "categoria_invalida",
  "servico_invalido",
  "documento_cancelado",
  "tem_liquidacao",
  "justificativa_obrigatoria",
  "estornar_antes",
  "ja_estornado",
  "data_invalida",
  "conta_invalida",
  "arquivo_invalido",
  "arquivo_grande",
  "nao_encontrado",
] as const;
export type FinError = (typeof FIN_ERRORS)[number] | "invalid" | "failed";

export function finError(error: { message?: string; details?: string | null } | null): { error: FinError; detail?: string } {
  const code = FIN_ERRORS.find((c) => error?.message === c);
  return code ? { error: code, detail: error?.details ?? undefined } : { error: "failed" };
}
