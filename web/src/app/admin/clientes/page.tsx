import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  tipo_cobranca: string | null;
  valor_acordado: number | null;
  anonimizado_em: string | null;
};

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser({ role: "admin" });
  const t = await getTranslations();
  const locale = await getLocale();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("clientes")
    .select("id, nome, telefone, email, cidade, tipo_cobranca, valor_acordado, anonimizado_em")
    .order("anonimizado_em", { nullsFirst: true })
    .order("nome")
    .limit(300);
  // Characters with meaning in PostgREST filters are dropped, so the search can't alter the query.
  const term = q.replace(/[,()%*\:"']/g, " ").trim();
  if (term) query = query.or(`nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%,endereco.ilike.%${term}%`);
  const { data } = await query;
  const clientes = (data ?? []) as Row[];

  const price = (c: Row) => (c.valor_acordado == null ? "—" : `${formatMoney(c.valor_acordado, locale)}${c.tipo_cobranca ? ` / ${t(`billing.${c.tipo_cobranca}`)}` : ""}`);

  return (
    <>
      <PageHeader
        title={t("nav.clients")}
        actions={
          <Button size="lg" render={<Link href="/admin/clientes/nuevo" />} nativeButton={false}>
            <Plus aria-hidden />
            {t("clients.new")}
          </Button>
        }
      />

      <form className="relative mb-4" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" type="search" defaultValue={q} placeholder={t("clients.searchPlaceholder")} aria-label={t("clients.searchPlaceholder")} className="h-10 bg-background pl-9" />
      </form>

      {clientes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{q ? t("clients.noResults") : t("clients.empty")}</CardContent>
        </Card>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/clientes/${c.id}`} className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">{[c.telefone, c.cidade].filter(Boolean).join(" · ") || "—"}</p>
                    {c.anonimizado_em && <Badge variant="secondary" className="mt-1">{t("clients.anonymized")}</Badge>}
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
                  <TableHead className="pl-4">{t("clients.fields.nome")}</TableHead>
                  <TableHead>{t("clients.fields.telefone")}</TableHead>
                  <TableHead>{t("clients.fields.email")}</TableHead>
                  <TableHead>{t("clients.fields.cidade")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("clients.fields.valor_acordado")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id} className="relative">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/admin/clientes/${c.id}`} className="after:absolute after:inset-0">
                        {c.nome}
                      </Link>
                      {c.anonimizado_em && <Badge variant="secondary" className="ml-2">{t("clients.anonymized")}</Badge>}
                    </TableCell>
                    <TableCell>{c.telefone ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate">{c.email ?? "—"}</TableCell>
                    <TableCell>{c.cidade ?? "—"}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{price(c)}</TableCell>
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
