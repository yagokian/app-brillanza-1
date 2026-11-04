import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CircleCheck, Download, HandCoins, History, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { docCode, type ParcelaRow } from "@/lib/financeiro";
import { formatDate, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { loadServicos } from "../../data";
import { AttachmentUpload, CancelDocumentButton, ReverseButton } from "../../documento-actions";
import { Situacao } from "../../situacao";

type Movimento = {
  id: string;
  parcela_id: string;
  tipo: "liquidacao" | "estorno";
  estorna_id: string | null;
  data_efetiva: string;
  valor_principal: number;
  juros: number;
  multa: number;
  desconto: number;
  valor_movimentado: number;
  observacao: string | null;
  justificativa: string | null;
  fin_contas: { nome: string } | null;
  fin_formas_pagamento: { nome: string } | null;
};

type Anexo = { id: string; movimento_id: string | null; tipo: string; nome_original: string; tamanho: number; created_at: string };

type Historico = {
  id: number;
  tabela: string;
  operacao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  justificativa: string | null;
  usuario_nome: string | null;
  created_at: string;
};

// Technical columns left out of the change list in the history.
const HIDDEN = new Set(["id", "created_at", "updated_at", "chave_idempotencia", "criado_por", "documento_id", "parcela_id", "cancelado_por", "caminho"]);

const MONEY = new Set(["valor", "valor_total", "valor_liquidado", "saldo", "valor_principal", "juros", "multa", "desconto", "valor_movimentado"]);

export default async function DocumentoPage({ params, searchParams }: PageProps<"/financeiro/documentos/[id]">) {
  await requireUser({ role: FIN_ROLES });
  const { id } = await params;
  const query = await searchParams;
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: doc }, { data: parcelasData }, { data: movData }, { data: anexosData }, { data: histData }] = await Promise.all([
    supabase.from("fin_documentos").select("*, fin_categorias(nome), fin_favorecidos(nome)").eq("id", id).maybeSingle(),
    supabase.rpc("rpc_fin_listar_parcelas", { p_filtros: { documento_id: id, limite: 200 } }),
    supabase
      .from("fin_movimentos")
      .select("id, parcela_id, tipo, estorna_id, data_efetiva, valor_principal, juros, multa, desconto, valor_movimentado, observacao, justificativa, fin_contas(nome), fin_formas_pagamento(nome)")
      .eq("documento_id", id)
      .order("created_at"),
    supabase.from("fin_anexos").select("id, movimento_id, tipo, nome_original, tamanho, created_at").eq("documento_id", id).order("created_at"),
    supabase.rpc("rpc_fin_historico", { p_documento_id: id }),
  ]);
  if (!doc) notFound();

  const parcelas = (parcelasData ?? []) as ParcelaRow[];
  const movimentos = (movData ?? []) as unknown as Movimento[];
  const anexos = (anexosData ?? []) as Anexo[];
  const historico = (histData ?? []) as Historico[];
  const parteNome = parcelas[0]?.parte_nome ?? doc.fin_favorecidos?.nome ?? "—";
  const servico = doc.servico_id ? (await loadServicos({ id: doc.servico_id }))[0] : null;
  const ativo = doc.situacao === "ativo";
  const pay = doc.natureza === "pagar";
  const money = (v: number | string) => formatMoney(v, locale);
  const reversed = new Set(movimentos.filter((m) => m.estorna_id).map((m) => m.estorna_id));
  const parcelaNumero = Object.fromEntries(parcelas.map((p) => [p.parcela_id, p.parcela_numero]));
  const anexosDoMovimento = (movId: string) => anexos.filter((a) => a.movimento_id === movId);
  const kb = (bytes: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, bytes / 1024))} KB`;

  const info: [string, React.ReactNode][] = [
    [t(pay ? "fields.payee" : "fields.party"), parteNome],
    [t("fields.tipo_documento"), [t(`docTypes.${doc.tipo_documento}`), doc.numero, doc.serie && `(${t("fields.serie")} ${doc.serie})`].filter(Boolean).join(" ")],
    [t("fields.data_emissao"), formatDate(doc.data_emissao, locale)],
    [t("fields.valor_total"), money(doc.valor_total)],
    [t("fields.categoria"), doc.fin_categorias?.nome ?? "—"],
    [t("fields.condicao"), `${t(`conditions.${doc.condicao}`)} · ${t("installmentsCount", { count: doc.num_parcelas })}`],
    [
      t("fields.servico"),
      servico ? `${formatDate(servico.data_servico, locale)} · ${servico.cliente_nome}` : doc.servico_id ? "✓" : t("noService"),
    ],
    [t("fields.observacoes"), doc.observacoes ?? "—"],
  ];
  if (!ativo) info.push([t("cancelReason"), `${doc.motivo_cancelamento} (${formatDate(doc.cancelado_em, locale)})`]);

  const fmtValue = (key: string, v: unknown) => {
    if (v == null || v === "") return "—";
    if (MONEY.has(key)) return money(v as number);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v, locale);
    return String(v);
  };

  return (
    <>
      <Link
        href={`/financeiro/${doc.natureza}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t(pay ? "payables" : "receivables")}
      </Link>
      <PageHeader
        title={doc.descricao}
        description={`${docCode(doc.numero_interno)} · ${t(pay ? "toPay" : "toReceive")} · ${parteNome}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="lg" render={<a href="#historico" />} nativeButton={false}>
              <History aria-hidden />
              {t("viewHistory")}
            </Button>
            {ativo && (
              <>
                <CancelDocumentButton documentoId={doc.id} />
                <Button size="lg" variant="outline" render={<Link href={`/financeiro/documentos/${doc.id}/editar`} />} nativeButton={false}>
                  <Pencil aria-hidden />
                  {t("edit")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {query.registrado && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-status-concluido/12 px-3 py-2 text-sm text-status-concluido">
          <CircleCheck className="size-4" aria-hidden />
          {t(pay ? "paymentRegistered" : "receiptRegistered")}
          {query.anexo === "erro" && ` ${t("proofFailed")}`}
        </p>
      )}
      {!ativo && (
        <Badge variant="secondary" className="mb-4">
          {t("status.cancelada")}
        </Badge>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr] lg:items-start">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t("sections.document")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              {info.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sections.installments")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {parcelas.map((p) => (
                  <li key={p.parcela_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {t("installmentOf", { n: p.parcela_numero, total: p.num_parcelas })} · {formatDate(p.vencimento, locale)}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {t("columns.original")} {money(p.valor)} · {t(pay ? "columns.paid" : "columns.received")} {money(p.valor_liquidado)} ·{" "}
                        <strong className="text-foreground">
                          {t("columns.balance")} {money(p.saldo)}
                        </strong>
                      </p>
                      <div className="mt-1">
                        <Situacao liquidacao={p.situacao_liquidacao} vencimento={p.situacao_vencimento} />
                      </div>
                    </div>
                    {p.situacao_vencimento && (
                      <Button size="sm" render={<Link href={`/financeiro/documentos/${doc.id}/registrar?parcela=${p.parcela_id}`} />} nativeButton={false}>
                        <HandCoins aria-hidden />
                        {t(pay ? "registerPayment" : "registerReceipt")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.movements")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {movimentos.length === 0 ? (
                <p className="px-4 text-sm text-muted-foreground">{t("noMovements")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">{t("fields.data_efetiva")}</TableHead>
                        <TableHead>{t("columns.installment")}</TableHead>
                        <TableHead className="text-right">{t("fields.valor_movimentado")}</TableHead>
                        <TableHead className="text-right">{t("fields.principal")}</TableHead>
                        <TableHead className="text-right">{t("columns.extras")}</TableHead>
                        <TableHead>{t("fields.conta")}</TableHead>
                        <TableHead className="pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentos.map((m) => {
                        const estorno = m.tipo === "estorno";
                        const wasReversed = reversed.has(m.id);
                        return (
                          <TableRow key={m.id} className={cn(wasReversed && "text-muted-foreground")}>
                            <TableCell className="pl-4 align-top whitespace-nowrap">
                              {formatDate(m.data_efetiva, locale)}
                              {estorno && (
                                <Badge variant="destructive" className="ml-2">
                                  {t("reversal")}
                                </Badge>
                              )}
                              {wasReversed && (
                                <Badge variant="secondary" className="ml-2">
                                  {t("reversed")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="align-top">{parcelaNumero[m.parcela_id] ?? "—"}</TableCell>
                            <TableCell className="text-right align-top font-medium tabular-nums">{money(m.valor_movimentado)}</TableCell>
                            <TableCell className="text-right align-top tabular-nums">{money(m.valor_principal)}</TableCell>
                            <TableCell className="text-right align-top text-xs tabular-nums">
                              {Number(m.juros) !== 0 && <div>{t("fields.juros")} {money(m.juros)}</div>}
                              {Number(m.multa) !== 0 && <div>{t("fields.multa")} {money(m.multa)}</div>}
                              {Number(m.desconto) !== 0 && <div>{t("fields.desconto")} {money(m.desconto)}</div>}
                            </TableCell>
                            <TableCell className="max-w-56 align-top text-sm">
                              {m.fin_contas?.nome} · {m.fin_formas_pagamento?.nome}
                              {(m.observacao || m.justificativa) && <p className="text-xs text-muted-foreground">{m.justificativa ?? m.observacao}</p>}
                              {anexosDoMovimento(m.id).map((a) => (
                                <a key={a.id} href={`/financeiro/anexos/${a.id}`} className="block text-xs text-primary hover:underline">
                                  {a.nome_original}
                                </a>
                              ))}
                            </TableCell>
                            <TableCell className="pr-4 text-right align-top">
                              {!estorno && !wasReversed && <ReverseButton movimentoId={m.id} documentoId={doc.id} />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sections.attachments")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("attachmentsHint")}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {anexos.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.nome_original}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`docTypes.${a.tipo}`)} · {kb(a.tamanho)} · {formatDate(a.created_at, locale)}
                        </span>
                      </span>
                      <Button size="sm" variant="outline" render={<a href={`/financeiro/anexos/${a.id}`} />} nativeButton={false}>
                        <Download aria-hidden />
                        {t("download")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <AttachmentUpload documentoId={doc.id} />
            </CardContent>
          </Card>
        </div>
      </div>

      <section id="historico" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 text-lg font-semibold">{t("sections.history")}</h2>
        <Card>
          <CardContent className="px-0">
            <ol className="divide-y">
              {historico.map((h) => {
                const changes = Object.keys(h.depois ?? h.antes ?? {}).filter((k) => !HIDDEN.has(k));
                return (
                  <li key={h.id} className="px-4 py-3 text-sm">
                    <p>
                      <strong>{t.has(`operations.${h.operacao}`) ? t(`operations.${h.operacao}`) : h.operacao}</strong>
                      {" · "}
                      {t(`tables.${h.tabela}`)} · {h.usuario_nome ?? t("unknownUser")} ·{" "}
                      <time dateTime={h.created_at}>
                        {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(h.created_at))}
                      </time>
                    </p>
                    {h.justificativa && (
                      <p className="mt-1">
                        {t("fields.justificativa")}: {h.justificativa}
                      </p>
                    )}
                    {h.antes && h.depois && changes.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {changes.map((k) => (
                          <li key={k}>
                            {k}: {fmtValue(k, h.antes?.[k])} → {fmtValue(k, h.depois?.[k])}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
