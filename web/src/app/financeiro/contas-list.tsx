import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, HandCoins, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isIsoDate } from "@/lib/dates";
import { FILTRO_SITUACOES, PERIODOS, docCode, type Natureza, type ParcelaRow } from "@/lib/financeiro";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadOptions } from "./data";
import { Situacao } from "./situacao";

export type ContasParams = {
  periodo?: string;
  de?: string;
  ate?: string;
  parte?: string;
  categoria?: string;
  situacao?: string;
  conta?: string;
  forma?: string;
  servico?: string;
};

const LIMIT = 500;
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/.test(v);

// Accounts payable or receivable: one row per installment, with filters in the URL.
export async function ContasList({ natureza, params }: { natureza: Natureza; params: ContasParams }) {
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const options = await loadOptions();

  // Without any filter the list opens on what is still open; "all" is an explicit empty value.
  const situacao = params.situacao === undefined ? "em_aberto" : (FILTRO_SITUACOES as readonly string[]).includes(params.situacao) ? params.situacao : "";
  const periodo = (PERIODOS as readonly string[]).includes(params.periodo ?? "") ? params.periodo! : "vencimento";
  const de = isIsoDate(params.de) ? params.de : "";
  const ate = isIsoDate(params.ate) ? params.ate : "";
  const parte = /^[cf]:[0-9a-f-]{36}$/.test(params.parte ?? "") ? params.parte! : "";
  const servico = params.servico === "com" || params.servico === "sem" ? params.servico : "";

  const filtros = {
    natureza,
    situacao: situacao || null,
    periodo: de || ate ? periodo : null,
    de: de || null,
    ate: ate || null,
    cliente_id: parte.startsWith("c:") ? parte.slice(2) : null,
    favorecido_id: parte.startsWith("f:") ? parte.slice(2) : null,
    categoria_id: isUuid(params.categoria) ? params.categoria : null,
    conta_id: isUuid(params.conta) ? params.conta : null,
    forma_id: isUuid(params.forma) ? params.forma : null,
    servico: servico || null,
    limite: LIMIT + 1,
  };
  const supabase = await createClient();
  const { data } = await supabase.rpc("rpc_fin_listar_parcelas", { p_filtros: filtros });
  const all = (data ?? []) as ParcelaRow[];
  const rows = all.slice(0, LIMIT);

  const money = (v: number) => formatMoney(v, locale);
  const sum = (key: "valor" | "valor_liquidado" | "saldo") => rows.reduce((total, r) => total + Number(r[key]), 0);
  const pay = natureza === "pagar";
  const parties = [
    ...options.favorecidos.map((f) => ({ value: `f:${f.id}`, label: f.nome })),
    ...(pay ? [] : options.clientes.map((c) => ({ value: `c:${c.id}`, label: c.nome }))),
  ].sort((a, b) => a.label.localeCompare(b.label, locale));
  const categorias = options.categorias.filter((c) => c.natureza === (pay ? "despesa" : "receita"));
  const docLabel = (r: ParcelaRow) =>
    [t(`docTypes.${r.tipo_documento}`), r.numero_documento && `${r.numero_documento}${r.serie ? `/${r.serie}` : ""}`].filter(Boolean).join(" ");

  const select = (name: string, label: string, value: string, items: { value: string; label: string }[], all = t("filters.all")) => (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <NativeSelect id={name} name={name} defaultValue={value} className="h-9 w-full">
        <option value="">{all}</option>
        {items.map((i) => (
          <option key={i.value} value={i.value}>
            {i.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <>
      <PageHeader
        title={t(pay ? "payables" : "receivables")}
        actions={
          <Button size="lg" render={<Link href={`/financeiro/novo?natureza=${natureza}`} />} nativeButton={false}>
            <Plus aria-hidden />
            {t(pay ? "newPayable" : "newReceivable")}
          </Button>
        }
      />

      <Card size="sm" className="mb-4">
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action={`/financeiro/${natureza}`}>
            {select("situacao", t("filters.status"), situacao, FILTRO_SITUACOES.map((s) => ({ value: s, label: t(`status.${s}`) })))}
            {select("parte", t(pay ? "fields.payee" : "fields.party"), parte, parties)}
            {select("categoria", t("fields.categoria"), isUuid(params.categoria) ? params.categoria! : "", categorias.map((c) => ({ value: c.id, label: c.nome })))}
            {select("servico", t("fields.servico"), servico, [
              { value: "com", label: t("filters.withService") },
              { value: "sem", label: t("filters.withoutService") },
            ])}
            <div className="flex flex-col gap-1">
              <Label htmlFor="periodo">{t("filters.period")}</Label>
              <NativeSelect id="periodo" name="periodo" defaultValue={periodo} className="h-9 w-full">
                {PERIODOS.map((p) => (
                  <option key={p} value={p}>
                    {t(`filters.periods.${p}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="de">{t("filters.from")}</Label>
                <Input id="de" name="de" type="date" defaultValue={de} className="h-9" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ate">{t("filters.to")}</Label>
                <Input id="ate" name="ate" type="date" defaultValue={ate} className="h-9" />
              </div>
            </div>
            {select("conta", t("fields.conta"), isUuid(params.conta) ? params.conta! : "", options.contas.map((c) => ({ value: c.id, label: c.nome })))}
            {select("forma", t("fields.forma"), isUuid(params.forma) ? params.forma! : "", options.formas.map((f) => ({ value: f.id, label: f.nome })))}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
              <Button type="submit">{t("filters.apply")}</Button>
              <Button variant="ghost" render={<Link href={`/financeiro/${natureza}?situacao=`} />} nativeButton={false}>
                {t("filters.clear")}
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{t("filters.accountHint")}</p>
        </CardContent>
      </Card>

      {all.length > LIMIT && <p className="mb-3 text-sm text-muted-foreground">{t("truncated", { count: LIMIT })}</p>}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.parcela_id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <Link href={`/financeiro/documentos/${r.documento_id}`} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.parte_nome}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.descricao} · {t("installmentOf", { n: r.parcela_numero, total: r.num_parcelas })}
                    </p>
                    <p className="mt-1 text-sm">
                      {t("fields.vencimento")}: {formatDate(r.vencimento, locale)}
                    </p>
                    <p className="text-sm tabular-nums">
                      {t("columns.balance")}: <strong>{money(r.saldo)}</strong> / {money(r.valor)}
                    </p>
                    <div className="mt-2">
                      <Situacao liquidacao={r.situacao_liquidacao} vencimento={r.situacao_vencimento} />
                    </div>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-muted-foreground" aria-hidden />
                </Link>
                {r.situacao_vencimento && (
                  <Button variant="outline" className="mt-3 w-full" render={<Link href={`/financeiro/documentos/${r.documento_id}/registrar?parcela=${r.parcela_id}`} />} nativeButton={false}>
                    <HandCoins aria-hidden />
                    {t(pay ? "registerPayment" : "registerReceipt")}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {/* Computers: table */}
          <div className="hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t(pay ? "fields.payee" : "fields.party")}</TableHead>
                  <TableHead>{t("columns.document")}</TableHead>
                  <TableHead>{t("columns.installment")}</TableHead>
                  <TableHead>{t("fields.vencimento")}</TableHead>
                  <TableHead className="text-right">{t("columns.original")}</TableHead>
                  <TableHead className="text-right">{t(pay ? "columns.paid" : "columns.received")}</TableHead>
                  <TableHead className="text-right">{t("columns.balance")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">{t("columns.actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.parcela_id}>
                    <TableCell className="max-w-48 truncate pl-4 font-medium">{r.parte_nome}</TableCell>
                    <TableCell className="max-w-64">
                      <Link href={`/financeiro/documentos/${r.documento_id}`} className="block truncate hover:underline">
                        {r.descricao}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {docCode(r.numero_interno)} · {docLabel(r)}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.parcela_numero}/{r.num_parcelas}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.vencimento, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.valor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(r.valor_liquidado)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(r.saldo)}</TableCell>
                    <TableCell>
                      <Situacao liquidacao={r.situacao_liquidacao} vencimento={r.situacao_vencimento} />
                    </TableCell>
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      {r.situacao_vencimento && (
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/financeiro/documentos/${r.documento_id}/registrar?parcela=${r.parcela_id}`} />}
                          nativeButton={false}
                        >
                          <HandCoins aria-hidden />
                          {t(pay ? "registerPayment" : "registerReceipt")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4" colSpan={4}>
                    {t("columns.total", { count: rows.length })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(sum("valor"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(sum("valor_liquidado"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(sum("saldo"))}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
