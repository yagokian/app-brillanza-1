import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { docCode } from "@/lib/financeiro";
import { createClient } from "@/lib/supabase/server";
import { loadFormChoices } from "../../../data";
import { DocumentoForm } from "../../../documento-form";

export default async function EditarDocumentoPage({ params }: PageProps<"/financeiro/documentos/[id]/editar">) {
  await requireUser({ role: FIN_ROLES });
  const { id } = await params;
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const supabase = await createClient();

  const [{ data: doc }, { data: parcelas }, { count }] = await Promise.all([
    supabase.from("fin_documentos").select("*").eq("id", id).maybeSingle(),
    supabase.from("fin_parcelas").select("numero, valor, vencimento").eq("documento_id", id).order("numero"),
    supabase.from("fin_movimentos").select("id", { count: "exact", head: true }).eq("documento_id", id),
  ]);
  if (!doc) notFound();
  if (doc.situacao === "cancelado") redirect(`/financeiro/documentos/${id}`);

  const initial: Record<string, string> = {
    id: doc.id,
    chave: doc.chave_idempotencia,
    parte: doc.cliente_id ? `c:${doc.cliente_id}` : `f:${doc.favorecido_id}`,
    descricao: doc.descricao,
    tipo_documento: doc.tipo_documento,
    numero: doc.numero ?? "",
    serie: doc.serie ?? "",
    data_emissao: doc.data_emissao,
    valor_total: Number(doc.valor_total).toFixed(2),
    categoria_id: doc.categoria_id,
    condicao: doc.condicao,
    observacoes: doc.observacoes ?? "",
    servico_id: doc.servico_id ?? "",
    parcelas: JSON.stringify((parcelas ?? []).map((p) => ({ valor: Number(p.valor).toFixed(2), vencimento: p.vencimento }))),
  };
  const choices = await loadFormChoices(doc.natureza, locale, t("clientSuffix"), initial);
  const back = `/financeiro/documentos/${id}`;

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {docCode(doc.numero_interno)}
      </Link>
      <PageHeader title={t("editDocument")} description={doc.descricao} />
      <DocumentoForm natureza={doc.natureza} {...choices} initial={initial} locked={(count ?? 0) > 0} cancelHref={back} />
    </>
  );
}
