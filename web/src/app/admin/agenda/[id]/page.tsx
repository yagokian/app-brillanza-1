import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { intervalToMinutes } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { loadOptions } from "../options";
import { ServicoForm } from "../servico-form";
import { ServicoActions } from "../../servico-actions";

export default async function EditarServicoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser({ role: "admin" });
  const { id } = await params;
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: s } = await supabase.from("servicos").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { clientes, colaboradoras } = await loadOptions({ clienteId: s.cliente_id, colaboradoraId: s.colaboradora_id });

  const initial: Record<string, string> = { id: s.id };
  for (const key of [
    "cliente_id",
    "colaboradora_id",
    "data_servico",
    "tipo_cobranca_cliente",
    "valor_cliente",
    "tipo_pagamento_colaboradora",
    "valor_colaboradora",
    "status",
    "motivo_cancelamento",
  ] as const) {
    if (s[key] != null) initial[key] = String(s[key]);
  }
  if (s.hora_inicio_prevista) initial.hora_inicio_prevista = s.hora_inicio_prevista.slice(0, 5);
  const minutes = intervalToMinutes(s.duracao_estimada);
  if (minutes != null) initial.duracao_minutos = String(minutes);

  const back = `/admin/agenda?d=${s.data_servico}`;
  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.schedule")}
      </Link>
      <PageHeader
        title={t("schedule.edit")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            <ServicoActions id={s.id} status={s.status} started={!!s.hora_inicio_real} label={s.data_servico} afterDelete={back} size="lg" />
          </div>
        }
      />
      {s.observacoes_colaboradora && (
        <p className="mb-4 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10">
          <span className="block text-xs text-muted-foreground">{t("schedule.workerNotes")}</span>
          {s.observacoes_colaboradora}
        </p>
      )}
      <ServicoForm initial={initial} clientes={clientes} colaboradoras={colaboradoras} cancelHref={back} />
    </>
  );
}
