import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { docCode, type ParcelaRow } from "@/lib/financeiro";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInMadrid } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";
import { loadOptions } from "../../../data";
import { MovimentoForm } from "../../../movimento-form";

export default async function RegistrarPage({ params, searchParams }: PageProps<"/financeiro/documentos/[id]/registrar">) {
  await requireUser({ role: FIN_ROLES });
  const { id } = await params;
  const { parcela } = await searchParams;
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data }, options] = await Promise.all([
    supabase.rpc("rpc_fin_listar_parcelas", { p_filtros: { documento_id: id, limite: 200 } }),
    loadOptions(),
  ]);
  const parcelas = (data ?? []) as ParcelaRow[];
  if (parcelas.length === 0) notFound();
  // Without a chosen installment: the first one with a balance.
  const p = parcelas.find((r) => r.parcela_id === parcela) ?? parcelas.find((r) => r.situacao_vencimento);
  if (!p || !p.situacao_vencimento) redirect(`/financeiro/documentos/${id}`);
  const pay = p.natureza === "pagar";

  return (
    <>
      <Link href={`/financeiro/documentos/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {docCode(p.numero_interno)} · {p.descricao}
      </Link>
      <PageHeader
        title={t(pay ? "registerPayment" : "registerReceipt")}
        description={`${p.parte_nome} · ${t("installmentOf", { n: p.parcela_numero, total: p.num_parcelas })} · ${t("fields.vencimento")} ${formatDate(p.vencimento, locale)} · ${t("columns.balance")} ${formatMoney(p.saldo, locale)}`}
      />
      <MovimentoForm
        natureza={p.natureza}
        documentoId={id}
        parcelaId={p.parcela_id}
        saldo={Number(p.saldo)}
        contas={options.contas.filter((c) => c.ativo).map((c) => ({ value: c.id, label: c.nome }))}
        formas={options.formas.filter((f) => f.ativo).map((f) => ({ value: f.id, label: f.nome }))}
        initial={{ chave: crypto.randomUUID(), data_efetiva: todayInMadrid(), valor: Number(p.saldo).toFixed(2) }}
        today={todayInMadrid()}
      />
    </>
  );
}
