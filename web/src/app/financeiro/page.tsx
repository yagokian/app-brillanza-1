import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDownCircle, ArrowUpCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { addDays, isIsoDate } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInMadrid } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Painel = {
  hoje: string;
  pagar_vencido: number;
  receber_vencido: number;
  pagar_hoje: number;
  receber_hoje: number;
  pagar_7dias: number;
  receber_7dias: number;
  pagar_mes: number;
  receber_mes: number;
  pago_periodo: number;
  recebido_periodo: number;
  saldo_movimentacoes: number;
};

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  await requireUser({ role: FIN_ROLES });
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const params = await searchParams;
  const today = todayInMadrid();
  const monthStart = `${today.slice(0, 8)}01`;
  const de = isIsoDate(params.de) ? params.de : monthStart;
  const ate = isIsoDate(params.ate) && params.ate >= de ? params.ate : lastDay(monthStart);

  const supabase = await createClient();
  const { data } = await supabase.rpc("rpc_fin_painel", { p_de: de, p_ate: ate }).single();
  const p = data as Painel | null;
  const money = (v: number | undefined) => formatMoney(v ?? 0, locale);

  const open = [
    { key: "overdue", pagar: p?.pagar_vencido, receber: p?.receber_vencido, filter: "situacao=vencida", alert: true },
    { key: "today", pagar: p?.pagar_hoje, receber: p?.receber_hoje, filter: "situacao=vence_hoje" },
    { key: "next7", pagar: p?.pagar_7dias, receber: p?.receber_7dias, filter: `situacao=em_aberto&periodo=vencimento&de=${today}&ate=${addDays(today, 6)}` },
    { key: "month", pagar: p?.pagar_mes, receber: p?.receber_mes, filter: `situacao=em_aberto&periodo=vencimento&de=${monthStart}&ate=${lastDay(monthStart)}` },
  ] as const;

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle", { date: formatDate(today, locale, { dateStyle: "full" }) })}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="outline" render={<Link href="/financeiro/novo?natureza=receber" />} nativeButton={false}>
              <Plus aria-hidden />
              {t("newReceivable")}
            </Button>
            <Button size="lg" render={<Link href="/financeiro/novo?natureza=pagar" />} nativeButton={false}>
              <Plus aria-hidden />
              {t("newPayable")}
            </Button>
          </div>
        }
      />

      <h2 className="mb-3 text-lg font-semibold">{t("dashboard.openBalances")}</h2>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("dashboard.openHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {open.map((card) => (
          <Card key={card.key} size="sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{t(`dashboard.${card.key}`)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link href={`/financeiro/pagar?${card.filter}`} className="flex items-center justify-between gap-2 rounded-md hover:underline">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <ArrowUpCircle className="size-4 text-muted-foreground" aria-hidden />
                  {t("toPay")}
                </span>
                <span className={cn("font-semibold tabular-nums", "alert" in card && card.alert && Number(card.pagar) > 0 && "text-destructive")}>
                  {money(card.pagar)}
                </span>
              </Link>
              <Link href={`/financeiro/receber?${card.filter}`} className="flex items-center justify-between gap-2 rounded-md hover:underline">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <ArrowDownCircle className="size-4 text-muted-foreground" aria-hidden />
                  {t("toReceive")}
                </span>
                <span className={cn("font-semibold tabular-nums", "alert" in card && card.alert && Number(card.receber) > 0 && "text-destructive")}>
                  {money(card.receber)}
                </span>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("dashboard.moved")}</h2>
            <p className="text-sm text-muted-foreground">{t("dashboard.movedHint")}</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/financeiro">
            <div className="flex flex-col gap-1">
              <Label htmlFor="de">{t("filters.from")}</Label>
              <Input id="de" name="de" type="date" defaultValue={de} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ate">{t("filters.to")}</Label>
              <Input id="ate" name="ate" type="date" defaultValue={ate} className="h-9" />
            </div>
            <Button type="submit" variant="outline">
              {t("filters.apply")}
            </Button>
          </form>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label={t("dashboard.received")} value={money(p?.recebido_periodo)} />
          <Kpi label={t("dashboard.paid")} value={money(p?.pago_periodo)} />
          <Kpi
            label={t("dashboard.movementBalance")}
            value={money(p?.saldo_movimentacoes)}
            hint={t("dashboard.movementBalanceHint")}
            negative={Number(p?.saldo_movimentacoes) < 0}
          />
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, hint, negative }: { label: string; value: string; hint?: string; negative?: boolean }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("text-2xl font-semibold tabular-nums", negative && "text-destructive")}>{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function lastDay(monthStart: string) {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

