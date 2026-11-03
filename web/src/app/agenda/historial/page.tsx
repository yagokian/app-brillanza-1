import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge, statusBorder } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { addDays, isIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { todayInMadrid, type WorkerService } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

// One page = 30 days (rpc_minha_agenda accepts up to 62), ending on ?ate= or yesterday.
const PAGE_DAYS = 30;

export default async function WorkerHistory({ searchParams }: { searchParams: Promise<{ ate?: string }> }) {
  await requireUser({ role: "worker" });
  const t = await getTranslations();
  const locale = await getLocale();
  const yesterday = addDays(todayInMadrid(), -1);
  const { ate: raw } = await searchParams;
  const ate = isIsoDate(raw) && raw < yesterday ? raw : yesterday;
  const desde = addDays(ate, -(PAGE_DAYS - 1));

  const supabase = await createClient();
  const { data } = await supabase.rpc("rpc_minha_agenda", { p_desde: desde, p_ate: ate });
  const services = ((data ?? []) as WorkerService[]).reverse();

  const newer = addDays(ate, PAGE_DAYS);
  const range = `${formatDate(desde, locale)} – ${formatDate(ate, locale)}`;

  return (
    <>
      <PageHeader title={t("nav.history")} description={range} />
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("worker.noHistory")}</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((service) => (
            <li key={service.id}>
              <Link href={`/agenda/${service.id}`} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <Card size="sm" className={`border-l-4 transition-colors hover:bg-muted/50 ${statusBorder[service.status]}`}>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{service.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(service.data_servico, locale, { weekday: "short", day: "numeric", month: "short" })}
                        {service.hora_inicio_prevista && ` · ${service.hora_inicio_prevista.slice(0, 5)}`}
                      </p>
                    </div>
                    <StatusBadge status={service.status} />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-6 flex justify-between gap-3">
        <Button variant="outline" size="lg" render={<Link href={`/agenda/historial?ate=${addDays(desde, -1)}`} />} nativeButton={false}>
          <ChevronLeft aria-hidden />
          {t("worker.older")}
        </Button>
        {ate < yesterday && (
          <Button
            variant="outline"
            size="lg"
            render={<Link href={newer >= yesterday ? "/agenda/historial" : `/agenda/historial?ate=${newer}`} />}
            nativeButton={false}
          >
            {t("worker.newer")}
            <ChevronRight aria-hidden />
          </Button>
        )}
      </nav>
    </>
  );
}
