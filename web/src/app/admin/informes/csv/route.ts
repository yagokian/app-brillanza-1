import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { decimal, toCsv } from "@/lib/csv";
import { loadServices, parseFilter, workedMinutes } from "../data";

export async function GET(request: Request) {
  await requireUser({ role: "admin" });
  const t = await getTranslations();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = parseFilter(params);
  const { services } = await loadServices(filter);

  const header = [
    t("schedule.fields.data"),
    t("reports.client"),
    t("reports.worker"),
    t("reports.status"),
    t("reports.hours"),
    t("reports.revenue"),
    t("reports.cost"),
    t("reports.margin"),
  ];
  const rows = services.map((s) => {
    const done = s.status === "concluido";
    const revenue = s.valor_cliente == null ? null : Number(s.valor_cliente);
    const cost = s.valor_colaboradora == null ? null : Number(s.valor_colaboradora);
    return [
      s.data_servico,
      s.clientes?.nome,
      s.colaboradoras?.nome,
      t(`status.${s.status}`),
      done ? decimal(workedMinutes(s) / 60) : "",
      decimal(revenue),
      decimal(cost),
      done ? decimal((revenue ?? 0) - (cost ?? 0)) : "",
    ];
  });

  const csv = toCsv([header, ...rows]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe_${filter.de}_${filter.ate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
