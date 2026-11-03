import { getTranslations } from "next-intl/server";
import { Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayInMadrid, type WorkerService } from "@/lib/servicos";

export default async function WorkerToday() {
  const user = await requireUser({ role: "worker" });
  const t = await getTranslations("worker");
  const supabase = await createClient();

  const today = todayInMadrid();
  const { data } = await supabase.rpc("rpc_minha_agenda", { p_desde: today, p_ate: today });
  const services = (data ?? []) as WorkerService[];

  return (
    <>
      <PageHeader title={t("greeting", { name: user.nome.split(" ")[0] })} description={t("todaySubtitle")} />
      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("noServices")}</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li key={service.id}>
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{service.cliente_nome}</p>
                    <StatusBadge status={service.status} />
                  </div>
                  {service.hora_inicio_prevista && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      {service.hora_inicio_prevista.slice(0, 5)}
                    </p>
                  )}
                  {service.cliente_endereco && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden />
                      {[service.cliente_endereco, service.cliente_codigo_postal, service.cliente_cidade]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
