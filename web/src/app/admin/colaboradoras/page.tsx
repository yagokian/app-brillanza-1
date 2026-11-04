import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { WEEK_DAYS } from "@/lib/colaboradoras";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  user_id: string | null;
  dias_disponiveis: string[] | null;
  tipo_pagamento: string | null;
  valor_pagamento: number | null;
  ativo: boolean;
  anonimizado_em: string | null;
};

export default async function ColaboradorasPage() {
  await requireUser({ role: "admin" });
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase
    .from("colaboradoras")
    .select("id, nome, telefone, email, user_id, dias_disponiveis, tipo_pagamento, valor_pagamento, ativo, anonimizado_em")
    .order("ativo", { ascending: false })
    .order("nome")
    .limit(300);
  const rows = (data ?? []) as Row[];

  const days = (r: Row) =>
    WEEK_DAYS.filter((d) => r.dias_disponiveis?.includes(d))
      .map((d) => t(`days.${d}`))
      .join(", ") || "—";
  const pay = (r: Row) =>
    r.valor_pagamento == null ? "—" : `${formatMoney(r.valor_pagamento, locale)}${r.tipo_pagamento ? ` / ${t(`billing.${r.tipo_pagamento}`)}` : ""}`;
  const badges = (r: Row) => (
    <>
      {!r.ativo && <Badge variant="secondary">{r.anonimizado_em ? t("clients.anonymized") : t("workers.inactive")}</Badge>}
      {r.ativo && !r.user_id && <Badge variant="outline">{t("workers.noLogin")}</Badge>}
    </>
  );

  return (
    <>
      <PageHeader
        title={t("nav.workers")}
        actions={
          <Button size="lg" render={<Link href="/admin/colaboradoras/nueva" />} nativeButton={false}>
            <Plus aria-hidden />
            {t("workers.new")}
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("workers.empty")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/colaboradoras/${r.id}`}
                  data-off={!r.ativo}
                  className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 data-[off=true]:opacity-60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">{r.telefone ?? r.email ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{days(r)}</p>
                    <div className="mt-1 flex gap-1 empty:hidden">{badges(r)}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>

          {/* Computers: table */}
          <Card className="hidden py-0 md:flex">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("workers.fields.nome")}</TableHead>
                  <TableHead>{t("workers.fields.telefone")}</TableHead>
                  <TableHead>{t("workers.fields.email")}</TableHead>
                  <TableHead>{t("workers.fields.dias_disponiveis")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("workers.fields.valor_pagamento")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-off={!r.ativo} className="relative data-[off=true]:opacity-60">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/admin/colaboradoras/${r.id}`} className="after:absolute after:inset-0">
                        {r.nome}
                      </Link>
                      <span className="ml-2 inline-flex gap-1">{badges(r)}</span>
                    </TableCell>
                    <TableCell>{r.telefone ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate">{r.email ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate">{days(r)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{pay(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
