import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, Clock, MapPin, Phone, StickyNote } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatMinutes, intervalToMinutes } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { todayInMadrid, type WorkerService } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { ServiceControls } from "./service-controls";

const formatTime = (locale: string, value: string | null) =>
  value ? new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value)) : null;

export default async function WorkerServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser({ role: "worker" });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.rpc("rpc_meu_servico", { p_id: id });
  const s = (data as WorkerService[] | null)?.[0];
  if (!s) notFound();

  const address = [s.cliente_endereco, s.cliente_codigo_postal, s.cliente_cidade].filter(Boolean).join(", ");
  const duration = formatMinutes(intervalToMinutes(s.duracao_estimada));
  const started = formatTime(locale, s.hora_inicio_real);
  const finished = formatTime(locale, s.hora_fim_real);
  const isPast = s.data_servico < todayInMadrid();

  return (
    <>
      <Link
        href={isPast ? "/agenda/historial" : "/agenda"}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t(isPast ? "nav.history" : "nav.today")}
      </Link>
      <PageHeader title={s.cliente_nome} actions={<StatusBadge status={s.status} />} />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {formatDate(s.data_servico, locale, { dateStyle: "full" })}
          </p>
          {(s.hora_inicio_prevista || duration) && (
            <p className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {[s.hora_inicio_prevista?.slice(0, 5), duration && t("worker.duration", { duration })].filter(Boolean).join(" · ")}
            </p>
          )}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <MapPin className="size-4 shrink-0" aria-hidden />
              {address}
            </a>
          )}
          {s.cliente_telefone && (
            <a
              href={`tel:${s.cliente_telefone.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              {s.cliente_telefone}
            </a>
          )}
          {s.cliente_notas && (
            <div className="flex gap-2 rounded-lg bg-muted p-3">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="whitespace-pre-line">
                <span className="block text-xs text-muted-foreground">{t("worker.clientNotes")}</span>
                {s.cliente_notas}
              </p>
            </div>
          )}
          {(started || finished) && (
            <p className="text-muted-foreground">
              {[started && t("worker.startedAt", { time: started }), finished && t("worker.finishedAt", { time: finished })]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* The key re-mounts the controls with fresh server data after each action. */}
      <ServiceControls
        key={`${s.status}-${s.observacoes_colaboradora ?? ""}-${JSON.stringify(s.checklist)}`}
        id={s.id}
        status={s.status}
        checklist={s.checklist ?? {}}
        observacoes={s.observacoes_colaboradora ?? ""}
      />
    </>
  );
}
