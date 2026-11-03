import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SERVICE_STATUSES, todayInMadrid } from "@/lib/servicos";

export default async function AdminDashboard() {
  const user = await requireUser({ role: "admin" });
  const t = await getTranslations("dashboard");
  const supabase = await createClient();

  const { data } = await supabase.from("servicos").select("status").eq("data_servico", todayInMadrid());
  const counts = Object.fromEntries(SERVICE_STATUSES.map((s) => [s, 0])) as Record<(typeof SERVICE_STATUSES)[number], number>;
  for (const row of data ?? []) counts[row.status as keyof typeof counts] += 1;

  return (
    <>
      <PageHeader title={t("greeting", { name: user.nome.split(" ")[0] })} description={t("subtitle")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SERVICE_STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-0">
              <CardTitle>
                <StatusBadge status={status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{counts[status]}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
