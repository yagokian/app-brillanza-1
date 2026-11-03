import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { RgpdPanel } from "@/components/rgpd/rgpd-panel";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { ServiceStatus } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

type ServicoRow = {
  id: string;
  data_servico: string;
  hora_inicio_prevista: string | null;
  status: ServiceStatus;
  valor_cliente: number | null;
  colaboradoras: { nome: string } | null;
};

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser({ role: "admin" });
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();

  const supabase = await createClient();
  const [{ data: c }, { data: servicosData }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("servicos")
      .select("id, data_servico, hora_inicio_prevista, status, valor_cliente, colaboradoras(nome)")
      .eq("cliente_id", id)
      .order("data_servico", { ascending: false })
      .order("hora_inicio_prevista", { ascending: false, nullsFirst: false })
      .limit(100),
  ]);
  if (!c) notFound();
  const servicos = (servicosData ?? []) as unknown as ServicoRow[];

  const rows: [string, string | null][] = [
    ["telefone", c.telefone],
    ["email", c.email],
    ["endereco", [c.endereco, c.codigo_postal, c.cidade].filter(Boolean).join(", ") || null],
    ["tipo_servico", c.tipo_servico],
    ["data_contratacao", c.data_contratacao && formatDate(c.data_contratacao, locale)],
    ["frequencia", c.frequencia],
    ["dia_semana", c.dia_semana],
    ["duracao_horario", c.duracao_horario],
    ["valor_acordado", c.valor_acordado == null ? null : `${formatMoney(c.valor_acordado, locale)}${c.tipo_cobranca ? ` / ${t(`billing.${c.tipo_cobranca}`)}` : ""}`],
    ["notas_para_colaboradora", c.notas_para_colaboradora],
    ["observacoes", c.observacoes],
    ["base_legal", t(`legalBasis.${c.base_legal}`)],
    ["aviso_privacidade_em", c.aviso_privacidade_em ? formatDate(c.aviso_privacidade_em, locale) : t("clients.noticePending")],
  ];

  return (
    <>
      <Link href="/admin/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.clients")}
      </Link>
      <PageHeader
        title={c.nome}
        description={c.anonimizado_em ? t("clients.anonymizedOn", { date: formatDate(c.anonimizado_em, locale) }) : undefined}
        actions={
          !c.anonimizado_em && (
            <Button size="lg" render={<Link href={`/admin/clientes/${c.id}/editar`} />} nativeButton={false}>
              <Pencil aria-hidden />
              {t("clients.edit")}
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("clients.sections.data")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3">
                {rows.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-muted-foreground">{t(`clients.fields.${key}`)}</dt>
                    <dd className="text-sm whitespace-pre-line">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <RgpdPanel kind="cliente" id={c.id} nome={c.nome} anonimizadoEm={c.anonimizado_em} />
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>{t("clients.history")}</CardTitle>
            {!c.anonimizado_em && (
              <Button variant="outline" render={<Link href={`/admin/agenda/nuevo?cliente=${c.id}`} />} nativeButton={false}>
                <Plus aria-hidden />
                {t("schedule.new")}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {servicos.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("clients.noHistory")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {servicos.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/agenda/${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:bg-muted/50">
                      <span className="w-32 text-sm font-medium tabular-nums">
                        {formatDate(s.data_servico, locale)} {s.hora_inicio_prevista?.slice(0, 5)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{s.colaboradoras?.nome ?? t("schedule.unassigned")}</span>
                      <span className="text-sm tabular-nums">{formatMoney(s.valor_cliente, locale)}</span>
                      <StatusBadge status={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {c.anonimizado_em && <Badge variant="secondary" className="mt-4">{t("clients.anonymized")}</Badge>}
    </>
  );
}
