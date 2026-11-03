import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { ClienteForm } from "../cliente-form";

export default async function NovoClientePage() {
  await requireUser({ role: "admin" });
  const t = await getTranslations("clients");
  return (
    <>
      <PageHeader title={t("new")} />
      <ClienteForm initial={{ cidade: "Barcelona", base_legal: "contrato" }} cancelHref="/admin/clientes" />
    </>
  );
}
