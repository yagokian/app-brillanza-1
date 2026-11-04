import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge, statusBorder } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { addDays, formatMinutes, intervalToMinutes, isIsoDate, weekStart } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { SERVICE_STATUSES, todayInMadrid, type ServiceStatus } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  data_servico: string;
  hora_inicio_prevista: string | null;
  duracao_estimada: string | null;
  status: ServiceStatus;
  clientes: { nome: string; cidade: string | null } | null;
  colaboradoras: { nome: string } | null;
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireUser({ role: "admin" });
  const t = await getTranslations();
  const locale = await getLocale();
  const today = todayInMadrid();
  const { d } = await searchParams;
  const selected = isIsoDate(d) ? d : today;
  const start = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("id, data_servico, hora_inicio_prevista, duracao_estimada, status, clientes(nome, cidade), colaboradoras(nome)")
    .gte("data_servico", days[0])
    .lte("data_servico", days[6])
    .order("hora_inicio_prevista", { nullsFirst: false })
    .limit(1000);
  const services = (data ?? []) as unknown as Row[];
  const byDay = new Map(days.map((day) => [day, services.filter((s) => s.data_servico === day)]));

  const weekday = (day: string) => formatDate(day, locale, { weekday: "short" });
  const dayNum = (day: string) => formatDate(day, locale, { day: "numeric" });
  const range = `${formatDate(days[0], locale, { day: "numeric", month: "short" })} – ${formatDate(days[6], locale, { day: "numeric", month: "short", year: "numeric" })}`;
  const href = (day: string) => `/admin/agenda?d=${day}`;

  return (
    <>
      <PageHeader
        title={t("nav.schedule")}
        actions={
          <Button size="lg" render={<Link href={`/admin/agenda/nuevo?d=${selected}`} />} nativeButton={false}>
            <Plus aria-hidden />
            {t("schedule.new")}
          </Button>
        }
      />

      {/* Week navigation (both layouts) */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon-lg" render={<Link href={href(addDays(selected, -7))} aria-label={t("schedule.prevWeek")} />} nativeButton={false}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="outline" size="icon-lg" render={<Link href={href(addDays(selected, 7))} aria-label={t("schedule.nextWeek")} />} nativeButton={false}>
          <ChevronRight aria-hidden />
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/admin/agenda" />} nativeButton={false}>
          {t("schedule.today")}
        </Button>
        <p className="ml-1 text-sm font-medium capitalize">{range}</p>
      </div>

      {/* Phones: pick a day, then a list */}
      <div className="md:hidden">
        <nav className="mb-4 grid grid-cols-7 gap-1" aria-label={t("schedule.week")}>
          {days.map((day) => (
            <Link
              key={day}
              href={href(day)}
              aria-current={day === selected ? "date" : undefined}
              className={cn(
                "flex flex-col items-center rounded-lg py-1.5 text-xs ring-1 ring-foreground/10",
                day === selected ? "bg-primary text-primary-foreground ring-primary" : "bg-card",
                day === today && day !== selected && "ring-2 ring-primary/60",
              )}
            >
              <span className="capitalize">{weekday(day)}</span>
              <span className="text-base font-semibold">{dayNum(day)}</span>
              <span className={cn("mt-0.5 size-1.5 rounded-full", byDay.get(day)!.length ? "bg-current" : "bg-transparent")} aria-hidden />
            </Link>
          ))}
        </nav>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground first-letter:uppercase">
          {formatDate(selected, locale, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {byDay.get(selected)!.length === 0 ? (
          <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">{t("schedule.emptyDay")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byDay.get(selected)!.map((s) => (
              <li key={s.id}>
                <ServiceCard service={s} unassigned={t("schedule.unassigned")} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Computers: the whole week */}
      <div className="hidden grid-cols-7 gap-2 md:grid">
        {days.map((day) => (
          <section key={day} className="flex min-w-0 flex-col gap-2">
            <Link
              href={`/admin/agenda/nuevo?d=${day}`}
              title={t("schedule.new")}
              className={cn(
                "group flex items-baseline justify-between rounded-lg px-2 py-1.5 hover:bg-muted",
                day === today && "bg-primary/10 text-primary",
              )}
            >
              <span className="text-xs capitalize">{weekday(day)}</span>
              <span className="text-lg font-semibold">{dayNum(day)}</span>
              <Plus className="size-3.5 opacity-0 group-hover:opacity-100" aria-hidden />
            </Link>
            {byDay.get(day)!.map((s) => (
              <ServiceCard key={s.id} service={s} unassigned={t("schedule.unassigned")} compact />
            ))}
          </section>
        ))}
      </div>
      <div className="mt-4 hidden flex-wrap gap-2 md:flex" aria-hidden>
        {SERVICE_STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    </>
  );
}

function ServiceCard({ service: s, unassigned, compact = false }: { service: Row; unassigned: string; compact?: boolean }) {
  const minutes = intervalToMinutes(s.duracao_estimada);
  const time = [s.hora_inicio_prevista?.slice(0, 5), minutes != null && formatMinutes(minutes)].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/admin/agenda/${s.id}`}
      className={cn(
        "flex flex-col gap-1 rounded-lg border-l-4 bg-card ring-1 ring-foreground/10 hover:bg-muted/60",
        statusBorder[s.status],
        compact ? "p-2 text-xs" : "p-3 text-sm",
        s.status === "cancelado" && "opacity-60",
      )}
    >
      {time && <span className="font-medium tabular-nums">{time}</span>}
      <span className={cn("font-medium", compact ? "line-clamp-2" : "truncate")}>{s.clientes?.nome}</span>
      <span className="truncate text-muted-foreground">{s.colaboradoras?.nome ?? unassigned}</span>
      {!compact && <StatusBadge status={s.status} className="self-start" />}
    </Link>
  );
}
