import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { isIsoDate } from "@/lib/dates";
import { todayInMadrid } from "@/lib/servicos";
import { loadOptions } from "../options";
import { ServicoForm } from "../servico-form";

export default async function NovoServicoPage({ searchParams }: { searchParams: Promise<{ d?: string; cliente?: string }> }) {
  await requireUser({ role: "admin" });
  const t = await getTranslations("schedule");
  const { d, cliente } = await searchParams;
  const date = isIsoDate(d) ? d : todayInMadrid();
  const { clientes, colaboradoras } = await loadOptions();

  // Coming from a client's page: start with that client and its agreed price.
  const preset = clientes.find((c) => c.id === cliente);
  const initial: Record<string, string> = { data_servico: date, status: "agendado" };
  if (preset) {
    initial.cliente_id = preset.id;
    if (preset.tipo) initial.tipo_cobranca_cliente = preset.tipo;
    if (preset.valor) initial.valor_cliente = preset.valor;
  }

  return (
    <>
      <PageHeader title={t("new")} />
      <ServicoForm initial={initial} clientes={clientes} colaboradoras={colaboradoras} cancelHref={`/admin/agenda?d=${date}`} />
    </>
  );
}
