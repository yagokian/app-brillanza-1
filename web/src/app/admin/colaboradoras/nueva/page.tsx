import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { ColaboradoraForm } from "../colaboradora-form";

export default async function NovaColaboradoraPage() {
  await requireUser({ role: "admin" });
  const t = await getTranslations("workers");
  return (
    <>
      <PageHeader title={t("new")} />
      <ColaboradoraForm initial={{ idioma: await getLocale() }} />
    </>
  );
}
