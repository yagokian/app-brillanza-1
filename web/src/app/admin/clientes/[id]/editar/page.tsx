import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm, type ClienteFormValues } from "../../cliente-form";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser({ role: "admin" });
  const { id } = await params;
  const t = await getTranslations("clients");

  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  if (data.anonimizado_em) redirect(`/admin/clientes/${id}`);

  // Every column as a string for the inputs; timestamps keep only the date part.
  const initial: ClienteFormValues = {};
  for (const [key, value] of Object.entries(data)) {
    if (value != null) initial[key] = key === "aviso_privacidade_em" ? String(value).slice(0, 10) : String(value);
  }

  return (
    <>
      <PageHeader title={t("edit")} description={data.nome} />
      <ClienteForm initial={initial} cancelHref={`/admin/clientes/${id}`} />
    </>
  );
}
