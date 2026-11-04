import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { todayInMadrid } from "@/lib/servicos";
import { loadFormChoices } from "../data";
import { DocumentoForm } from "../documento-form";

export default async function NovoDocumentoPage({ searchParams }: { searchParams: Promise<{ natureza?: string }> }) {
  await requireUser({ role: FIN_ROLES });
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const natureza = (await searchParams).natureza === "receber" ? "receber" : "pagar";
  const choices = await loadFormChoices(natureza, locale, t("clientSuffix"));
  const today = todayInMadrid();
  const back = `/financeiro/${natureza}`;

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t(natureza === "pagar" ? "payables" : "receivables")}
      </Link>
      <PageHeader title={t(natureza === "pagar" ? "newPayable" : "newReceivable")} />
      <DocumentoForm
        natureza={natureza}
        {...choices}
        cancelHref={back}
        // A fresh key per form: a resent or double-clicked submit creates the document only once.
        initial={{ chave: crypto.randomUUID(), data_emissao: today, tipo_documento: "fatura", condicao: "a_vista" }}
      />
    </>
  );
}
