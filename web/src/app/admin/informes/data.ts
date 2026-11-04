import "server-only";
import { addDays, intervalToMinutes, isIsoDate } from "@/lib/dates";
import { SERVICE_STATUSES, todayInMadrid, type ServiceStatus } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

export type ReportParams = { de?: string; ate?: string; cliente?: string; colaboradora?: string };

export type ReportFilter = { de: string; ate: string; cliente: string | null; colaboradora: string | null };

export type ReportService = {
  id: string;
  data_servico: string;
  status: ServiceStatus;
  duracao_estimada: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  valor_cliente: number | null;
  valor_colaboradora: number | null;
  cliente_id: string;
  colaboradora_id: string | null;
  clientes: { nome: string } | null;
  colaboradoras: { nome: string } | null;
};

export type Totals = { servicos: number; minutos: number; faturamento: number; custo: number };

export type GroupRow = Totals & { id: string; nome: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROWS = 5000;

export function monthStart(date: string) {
  return `${date.slice(0, 8)}01`;
}

export function monthEnd(date: string) {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Defaults to the current month. A reversed range is swapped instead of showing nothing.
export function parseFilter(params: ReportParams): ReportFilter {
  const today = todayInMadrid();
  let de = isIsoDate(params.de) ? params.de : monthStart(today);
  let ate = isIsoDate(params.ate) ? params.ate : monthEnd(today);
  if (de > ate) [de, ate] = [ate, de];
  return {
    de,
    ate,
    cliente: params.cliente && UUID.test(params.cliente) ? params.cliente : null,
    colaboradora: params.colaboradora && UUID.test(params.colaboradora) ? params.colaboradora : null,
  };
}

export function filterQuery(filter: ReportFilter) {
  const query = new URLSearchParams({ de: filter.de, ate: filter.ate });
  if (filter.cliente) query.set("cliente", filter.cliente);
  if (filter.colaboradora) query.set("colaboradora", filter.colaboradora);
  return query;
}

export async function loadServices(filter: ReportFilter) {
  const supabase = await createClient();
  let query = supabase
    .from("servicos")
    .select(
      "id, data_servico, status, duracao_estimada, hora_inicio_real, hora_fim_real, valor_cliente, valor_colaboradora, cliente_id, colaboradora_id, clientes(nome), colaboradoras(nome)",
    )
    .gte("data_servico", filter.de)
    .lte("data_servico", filter.ate)
    .order("data_servico")
    .order("hora_inicio_prevista", { nullsFirst: false })
    .limit(MAX_ROWS);
  if (filter.cliente) query = query.eq("cliente_id", filter.cliente);
  if (filter.colaboradora) query = query.eq("colaboradora_id", filter.colaboradora);
  const { data, error } = await query;
  if (error) throw error;
  const services = (data ?? []) as unknown as ReportService[];
  return { services, truncated: services.length === MAX_ROWS };
}

// Real time when both clock-ins exist, otherwise the estimate.
export function workedMinutes(s: ReportService) {
  if (s.hora_inicio_real && s.hora_fim_real) {
    return Math.round((Date.parse(s.hora_fim_real) - Date.parse(s.hora_inicio_real)) / 60000);
  }
  return intervalToMinutes(s.duracao_estimada) ?? 0;
}

// Only finished services count for services, hours and money.
function add(totals: Totals, s: ReportService) {
  if (s.status !== "concluido") return;
  totals.servicos += 1;
  totals.minutos += workedMinutes(s);
  totals.faturamento += Number(s.valor_cliente ?? 0);
  totals.custo += Number(s.valor_colaboradora ?? 0);
}

const empty = (): Totals => ({ servicos: 0, minutos: 0, faturamento: 0, custo: 0 });

export function summarize(services: ReportService[]) {
  const counts = Object.fromEntries(SERVICE_STATUSES.map((s) => [s, 0])) as Record<ServiceStatus, number>;
  const totals = empty();
  let estimados = 0;
  for (const s of services) {
    counts[s.status] += 1;
    add(totals, s);
    if (s.status !== "cancelado") estimados += intervalToMinutes(s.duracao_estimada) ?? 0;
  }
  return { counts, totals, estimados };
}

export function groupBy(services: ReportService[], key: "cliente" | "colaboradora", fallback: string): GroupRow[] {
  const groups = new Map<string, GroupRow>();
  for (const s of services) {
    const id = (key === "cliente" ? s.cliente_id : s.colaboradora_id) ?? "";
    const nome = (key === "cliente" ? s.clientes?.nome : s.colaboradoras?.nome) ?? fallback;
    let row = groups.get(id);
    if (!row) groups.set(id, (row = { id, nome, ...empty() }));
    add(row, s);
  }
  return [...groups.values()];
}

export const margin = (t: Totals) => t.faturamento - t.custo;
export const marginPct = (t: Totals) => (t.faturamento > 0 ? (margin(t) / t.faturamento) * 100 : null);

export const SORT_KEYS = ["nome", "servicos", "minutos", "faturamento", "custo", "margem"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function parseSort(value: string | undefined): { key: SortKey; desc: boolean } {
  const desc = !value?.endsWith("_asc");
  const key = value?.replace(/_(asc|desc)$/, "") as SortKey;
  return SORT_KEYS.includes(key) ? { key, desc } : { key: "faturamento", desc: true };
}

export function sortRows(rows: GroupRow[], { key, desc }: { key: SortKey; desc: boolean }) {
  const value = (r: GroupRow) => (key === "margem" ? margin(r) : r[key]);
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const cmp = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return desc ? -cmp : cmp;
  });
}

export function presets(today: string) {
  const lastMonth = addDays(monthStart(today), -1);
  return {
    thisMonth: { de: monthStart(today), ate: monthEnd(today) },
    lastMonth: { de: monthStart(lastMonth), ate: monthEnd(lastMonth) },
    thisYear: { de: `${today.slice(0, 4)}-01-01`, ate: `${today.slice(0, 4)}-12-31` },
  };
}
