import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UsuarioForm, UsuarioRow } from "./usuarios-client";

// Admin only: logins with the 'financeiro' role (financial module only, 2FA required).
export default async function UsuariosFinanceiroPage() {
  await requireUser({ role: "admin" });
  const t = await getTranslations("finance.users");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, nome, ativo").eq("tipo", "financeiro").order("nome");
  const admin = createAdminClient();
  const users = await Promise.all(
    (data ?? []).map(async (p) => ({ ...p, email: (await admin?.auth.admin.getUserById(p.id))?.data.user?.email ?? null })),
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{t("list")}</CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {users.map((u) => (
                  <li key={u.id} className="py-3">
                    <UsuarioRow id={u.id} nome={u.nome} email={u.email} ativo={u.ativo} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("new")}</CardTitle>
          </CardHeader>
          <CardContent>
            <UsuarioForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
