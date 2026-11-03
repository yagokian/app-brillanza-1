import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge, statusBorder } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { addDays, isIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_STATUSES, todayInMadrid, type ServiceStatus } from "@/lib/servicos";
import { cn } from "@/lib/utils";
import { DayPicker } from "./day-picker";

type Row = {
  id: string;
  hora_inicio_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  status: ServiceStatus;
  motivo_cancelamento: string | null;
  clientes: { nome: string } | null;
  colaboradoras: { nome: string } | null;
};

const isStatus = (value: unknown): value is ServiceStatus => SERVICE_STATUSES.includes(value as ServiceStatus);

const nowInMadrid = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ status?: string; d?: string }> }) {
  const user = await requireUser({ role: "admin" });
  const t = await getTranslations();
  const locale = await getLocale();
  const { status: raw, d } = await searchParams;
  const selected = isStatus(raw) ? raw : null;
  const today = todayInMadrid();
  const day = isIsoDate(d) ? d : today;
  const supabase = await createClient();

  const { data } = await supabase
    .from("servicos")
    .select("id, hora_inicio_prevista, hora_inicio_real, hora_fim_real, status, motivo_cancelamento, clientes(nome), colaboradoras(nome)")
    .eq("data_servico", day)
    .order("hora_inicio_prevista", { nullsFirst: false })
    .limit(500);
  const services = (data ?? []) as unknown as Row[];
  const counts = Object.fromEntries(SERVICE_STATUSES.map((s) => [s, 0])) as Record<ServiceStatus, number>;
  for (const row of services) counts[row.status] += 1;
  const shown = selected ? services.filter((s) => s.status === selected) : services;

  // Needs attention: still scheduled after its start time, or nobody assigned to it.
  const now = nowInMadrid();
  const isLate = (s: Row) =>
    s.status === "agendado" && (day < today || (day === today && !!s.hora_inicio_prevista && s.hora_inicio_prevista.slice(0, 5) < now));
  const isUnassigned = (s: Row) => !s.colaboradoras && (s.status === "agendado" || s.status === "em_andamento");
  const late = services.filter(isLate).length;
  const unassigned = services.filter(isUnassigned).length;

  const time = (value: string | null) =>
    value ? new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value)) : null;
  const href = (params: { d?: string; status?: ServiceStatus | null }) => {
    const query = new URLSearchParams();
    if (params.d && params.d !== today) query.set("d", params.d);
    if (params.status) query.set("status", params.status);
    return query.size ? `/admin?${query}` : "/admin";
  };

  return (
    <>
      <PageHeader title={t("dashboard.greeting", { name: user.nome.split(" ")[0] })} description={t("dashboard.subtitle")} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          render={<Link href={href({ d: addDays(day, -1), status: selected })} aria-label={t("dashboard.prevDay")} />}
          nativeButton={false}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          render={<Link href={href({ d: addDays(day, 1), status: selected })} aria-label={t("dashboard.nextDay")} />}
          nativeButton={false}
        >
          <ChevronRight aria-hidden />
        </Button>
        {day !== today && (
          <Button variant="outline" size="lg" render={<Link href={href({ status: selected })} />} nativeButton={false}>
            {t("schedule.today")}
          </Button>
        )}
        <DayPicker day={day} status={selected} label={t("schedule.fields.data")} />
        <p className="ml-1 text-sm font-medium capitalize">{formatDate(day, locale, { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SERVICE_STATUSES.map((status) => (
          // Clicking the selected card again shows every service of the day.
          <Link
            key={status}
            href={href({ d: day, status: selected === status ? null : status })}
            aria-current={selected === status ? "true" : undefined}
            className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className={cn("h-full transition-colors hover:bg-muted/50", selected === status && "ring-2 ring-primary")}>
              <CardHeader className="pb-0">
                <CardTitle>
                  <StatusBadge status={status} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{counts[status]}</p>
                {status === "agendado" && late > 0 && (
                  <p className="mt-1 text-xs font-medium text-destructive">{t("dashboard.lateCount", { count: late })}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {unassigned > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {t("dashboard.unassignedCount", { count: unassigned })}
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">
          {selected ? t(`status.${selected}`) : t("dashboard.listAll")}
        </h2>
        {shown.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">{t("dashboard.empty")}</CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((s) => {
              const started = time(s.hora_inicio_real);
              const finished = time(s.hora_fim_real);
              return (
                <li key={s.id}>
                  <Link
                    href={`/admin/agenda/${s.id}`}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border-l-4 bg-card p-3 text-sm ring-1 ring-foreground/10 hover:bg-muted/60",
                      statusBorder[s.status],
                    )}
                  >
                    <span className="w-12 font-medium tabular-nums">{s.hora_inicio_prevista?.slice(0, 5) ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.clientes?.nome}</span>
                      <span className={cn("block truncate", isUnassigned(s) ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {s.colaboradoras?.nome ?? t("schedule.unassigned")}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      {!selected && <StatusBadge status={s.status} />}
                      {isLate(s) && <span className="font-medium text-destructive">{t("dashboard.late")}</span>}
                      {started && <span>{t("worker.startedAt", { time: started })}</span>}
                      {finished && <span>{t("worker.finishedAt", { time: finished })}</span>}
                      {s.status === "cancelado" && s.motivo_cancelamento && (
                        <span className="max-w-48 truncate">{s.motivo_cancelamento}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
