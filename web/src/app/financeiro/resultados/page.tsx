import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { isIsoDate } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInMadrid } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Mes = { mes: string; servicos: number; receita_servicos: number; custo_colaboradoras: number; despesas: number; resultado: number };
type Categoria = { categoria_id: string; categoria: string; documentos: number; total: number };

const monthEnd = (date: string) => {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

// Results by month: revenue and worker cost of finished services, minus expenses entered in the
// financial module (by issue date). An estimate of profit, not the cash movements of the dashboard.
export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requireUser({ role: FIN_ROLES });
  const t = await getTranslations("finance.results");
  const locale = await getLocale();
  const params = await searchParams;
  const today = todayInMadrid();
  let de = isIsoDate(params.de) ? params.de : `${today.slice(0, 4)}-01-01`;
  let ate = isIsoDate(params.ate) ? params.ate : monthEnd(today);
  if (de > ate) [de, ate] = [ate, de];

  const supabase = await createClient();
  const [{ data: mesesData }, { data: catData }] = await Promise.all([
    supabase.rpc("rpc_fin_resultados", { p_de: de, p_ate: ate }),
    supabase.rpc("rpc_fin_despesas_categoria", { p_de: de, p_ate: ate }),
  ]);
  const meses = ((mesesData ?? []) as Mes[]).slice(0, 36);
  const categorias = (catData ?? []) as Categoria[];

  const total = meses.reduce(
    (acc, m) => ({
      servicos: acc.servicos + m.servicos,
      receita: acc.receita + Number(m.receita_servicos),
      custo: acc.custo + Number(m.custo_colaboradoras),
      despesas: acc.despesas + Number(m.despesas),
    }),
    { servicos: 0, receita: 0, custo: 0, despesas: 0 },
  );
  const resultado = total.receita - total.custo - total.despesas;
  const margem = total.receita > 0 ? (resultado / total.receita) * 100 : null;
  const money = (v: number | string) => formatMoney(v, locale);
  const pct = (v: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(v)} %`;
  const maxCat = Math.max(...categorias.map((c) => Number(c.total)), 1);
  const month = (iso: string) => formatDate(iso, locale, { month: "short", year: "numeric" });
  const shortcuts = [
    { label: t("thisMonth"), de: `${today.slice(0, 8)}01`, ate: monthEnd(today) },
    { label: t("thisYear"), de: `${today.slice(0, 4)}-01-01`, ate: `${today.slice(0, 4)}-12-31` },
    { label: t("lastYear"), de: `${Number(today.slice(0, 4)) - 1}-01-01`, ate: `${Number(today.slice(0, 4)) - 1}-12-31` },
  ];

  const kpis = [
    { label: t("revenue"), value: money(total.receita), hint: t("servicesCount", { count: total.servicos }) },
    { label: t("workerCost"), value: money(total.custo) },
    { label: t("expenses"), value: money(total.despesas) },
    { label: t("result"), value: money(resultado), hint: margem == null ? undefined : t("margin", { value: pct(margem) }), negative: resultado < 0 },
  ];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        {shortcuts.map((s) => (
          <Button key={s.label} variant={s.de === de && s.ate === ate ? "default" : "outline"} render={<Link href={`/financeiro/resultados?de=${s.de}&ate=${s.ate}`} />} nativeButton={false}>
            {s.label}
          </Button>
        ))}
        <form className="flex flex-wrap items-end gap-2" action="/financeiro/resultados">
          <div className="flex flex-col gap-1">
            <Label htmlFor="de">{t("from")}</Label>
            <Input id="de" name="de" type="date" defaultValue={de} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ate">{t("to")}</Label>
            <Input id="ate" name="ate" type="date" defaultValue={ate} className="h-9" />
          </div>
          <Button type="submit" variant="outline">
            {t("apply")}
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <span className={cn("text-2xl font-semibold tabular-nums", k.negative && "text-destructive")}>{k.value}</span>
              {k.hint && <span className="text-xs text-muted-foreground">{k.hint}</span>}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("howItWorks")}</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("byMonth")}</h2>
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("month")}</TableHead>
                  <TableHead className="text-right">{t("revenue")}</TableHead>
                  <TableHead className="text-right">{t("workerCost")}</TableHead>
                  <TableHead className="text-right">{t("expenses")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map((m) => (
                  <TableRow key={m.mes}>
                    <TableCell className="pl-4 capitalize">{month(m.mes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(m.receita_servicos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(m.custo_colaboradoras)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(m.despesas)}</TableCell>
                    <TableCell className={cn("pr-4 text-right font-medium tabular-nums", Number(m.resultado) < 0 && "text-destructive")}>
                      {Number(m.resultado) < 0 ? "▼ " : ""}
                      {money(m.resultado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4">{t("total")}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(total.receita)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(total.custo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(total.despesas)}</TableCell>
                  <TableCell className={cn("pr-4 text-right tabular-nums", resultado < 0 && "text-destructive")}>{money(resultado)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">{t("byCategory")}</h2>
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>{t("byCategory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {categorias.map((c) => (
                    <li key={c.categoria_id} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{c.categoria}</span>
                        <span className="tabular-nums">
                          {money(c.total)}
                          {total.despesas > 0 && <span className="ml-2 text-muted-foreground">{pct((Number(c.total) / total.despesas) * 100)}</span>}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(Number(c.total) / maxCat) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
