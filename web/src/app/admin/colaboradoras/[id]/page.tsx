import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { RgpdPanel } from "@/components/rgpd/rgpd-panel";
import { PageHeader } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ColaboradoraForm } from "../colaboradora-form";
import { AccessPanel } from "./access-panel";

export default async function EditarColaboradoraPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser({ role: "admin" });
  const { id } = await params;
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.from("colaboradoras").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  // Every column as a string for the inputs; arrays as comma-separated lists.
  const initial: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    initial[key] = Array.isArray(value) ? value.join(key === "tipos_de_servico" ? ", " : ",") : String(value);
  }

  return (
    <>
      <Link href="/admin/colaboradoras" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("nav.workers")}
      </Link>
      <PageHeader title={data.nome} />
      {data.anonimizado_em ? (
        <div className="max-w-xl">
          <RgpdPanel kind="colaboradora" id={data.id} nome={data.nome} anonimizadoEm={data.anonimizado_em} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
          <ColaboradoraForm initial={initial} hasLogin={!!data.user_id} />
          <div className="flex flex-col gap-4">
            <AccessPanel id={data.id} ativo={data.ativo} hasLogin={!!data.user_id} hasEmail={!!data.email} />
            <RgpdPanel kind="colaboradora" id={data.id} nome={data.nome} anonimizadoEm={null} />
          </div>
        </div>
      )}
    </>
  );
}
