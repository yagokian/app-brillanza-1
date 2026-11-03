import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatMinutes } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { SERVICE_STATUSES, todayInMadrid } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  filterQuery,
  groupBy,
  loadServices,
  margin,
  marginPct,
  parseFilter,
  parseSort,
  presets,
  sortRows,
  summarize,
  type GroupRow,
  type ReportParams,
  type SortKey,
  type Totals,
} from "./data";

type SearchParams = ReportParams & { cs?: string; ws?: string };

export default async function InformesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser({ role: "admin" });
  const t = await getTranslations();
  const locale = await getLocale();
  const params = await searchParams;
  const filter = parseFilter(params);
  const supabase = await createClient();

  const [{ services, truncated }, { data: clientes }, { data: colaboradoras }] = await Promise.all([
    loadServices(filter),
    supabase.from("clientes").select("id, nome").is("anonimizado_em", null).order("nome").limit(1000),
    supabase.from("colaboradoras").select("id, nome").order("nome").limit(500),
  ]);
  const { counts, totals, estimados } = summarize(services);
  const clientSort = parseSort(params.cs);
  const workerSort = parseSort(params.ws);
  const byClient = sortRows(groupBy(services, "cliente", "—"), clientSort);
  const byWorker = sortRows(groupBy(services, "colaboradora", t("schedule.unassigned")), workerSort);

  const money = (value: number) => formatMoney(value, locale);
  const pct = (row: Totals) => {
    const value = marginPct(row);
    return value == null ? "—" : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} %`;
  };
  const hours = (minutes: number) => formatMinutes(minutes) || "0h";

  const href = (extra: Record<string, string | undefined>) => {
    const query = filterQuery(filter);
    for (const [key, value] of Object.entries({ cs: params.cs, ws: params.ws, ...extra })) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    return `/admin/informes?${query}`;
  };
  const periodHref = (period: { de: string; ate: string }) => {
    const query = new URLSearchParams(period);
    if (filter.cliente) query.set("cliente", filter.cliente);
    if (filter.colaboradora) query.set("colaboradora", filter.colaboradora);
    return `/admin/informes?${query}`;
  };
  const shortcuts = presets(todayInMadrid());

  const kpis = [
    { label: t("reports.revenue"), value: money(totals.faturamento) },
    { label: t("reports.cost"), value: money(totals.custo) },
    { label: t("reports.margin"), value: money(margin(totals)), hint: pct(totals) },
    { label: t("reports.hoursWorked"), value: hours(totals.minutos), hint: t("reports.hoursPlanned", { hours: hours(estimados) }) },
  ];

  const table = (title: string, rows: GroupRow[], sortParam: "cs" | "ws", sort: { key: SortKey; desc: boolean }) => {
    const header = (key: SortKey, label: string, numeric = true) => {
      const active = sort.key === key;
      // Text sorts A→Z first; numbers biggest first.
      const nextDesc = active ? !sort.desc : numeric;
      const Icon = sort.desc ? ArrowDown : ArrowUp;
      return (
        <TableHead className={cn(numeric && "text-right")} aria-sort={active ? (sort.desc ? "descending" : "ascending") : undefined}>
          <Link href={href({ [sortParam]: `${key}_${nextDesc ? "desc" : "asc"}` })} scroll={false} className="inline-flex items-center gap-1 hover:underline">
            {label}
            {active && <Icon className="size-3.5" aria-hidden />}
          </Link>
        </TableHead>
      );
    };
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">{t("reports.empty")}</CardContent>
          </Card>
        ) : (
          <div className="rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  {header("nome", t("reports.name"), false)}
                  {header("servicos", t("reports.services"))}
                  {header("minutos", t("reports.hours"))}
                  {header("faturamento", t("reports.revenue"))}
                  {header("custo", t("reports.cost"))}
                  {header("margem", t("reports.margin"))}
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id || "none"}>
                    <TableCell className="max-w-56 truncate font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.servicos}</TableCell>
                    <TableCell className="text-right tabular-nums">{hours(r.minutos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.faturamento)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.custo)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", margin(r) < 0 && "text-destructive")}>{money(margin(r))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{pct(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t("reports.total")}</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.servicos}</TableCell>
                  <TableCell className="text-right tabular-nums">{hours(totals.minutos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(totals.faturamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(totals.custo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(margin(totals))}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(totals)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <PageHeader
        title={t("nav.reports")}
        description={`${formatDate(filter.de, locale)} – ${formatDate(filter.ate, locale)}`}
        actions={
          // Plain link: the browser downloads the file the route returns.
          <Button variant="outline" size="lg" render={<a href={`/admin/informes/csv?${filterQuery(filter)}`} download />} nativeButton={false}>
            <Download aria-hidden />
            {t("reports.exportCsv")}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {(["thisMonth", "lastMonth", "thisYear"] as const).map((key) => {
          const active = shortcuts[key].de === filter.de && shortcuts[key].ate === filter.ate;
          return (
            <Button key={key} variant={active ? "default" : "outline"} render={<Link href={periodHref(shortcuts[key])} />} nativeButton={false}>
              {t(`reports.${key}`)}
            </Button>
          );
        })}
      </div>

      <form className="mb-6 grid grid-cols-2 gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:grid-cols-5 lg:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="de">{t("reports.from")}</Label>
          <Input id="de" name="de" type="date" defaultValue={filter.de} className="h-10" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ate">{t("reports.to")}</Label>
          <Input id="ate" name="ate" type="date" defaultValue={filter.ate} className="h-10" required />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
          <Label htmlFor="cliente">{t("reports.client")}</Label>
          <NativeSelect id="cliente" name="cliente" defaultValue={filter.cliente ?? ""} className="h-10">
            <option value="">{t("reports.all")}</option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
          <Label htmlFor="colaboradora">{t("reports.worker")}</Label>
          <NativeSelect id="colaboradora" name="colaboradora" defaultValue={filter.colaboradora ?? ""} className="h-10">
            <option value="">{t("reports.all")}</option>
            {(colaboradoras ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" size="lg" className="col-span-2 h-10 lg:col-span-1">
          {t("reports.apply")}
        </Button>
      </form>

      {truncated && <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t("reports.truncated")}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SERVICE_STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-0">
              <CardTitle>
                <StatusBadge status={status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
              {kpi.hint && <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("reports.onlyFinished")}</p>

      {table(t("reports.byClient"), byClient, "cs", clientSort)}
      {table(t("reports.byWorker"), byWorker, "ws", workerSort)}
    </>
  );
}
