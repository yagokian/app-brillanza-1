import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { personPath, personTable, type PersonKind } from "@/lib/rgpd";
import { createClient } from "@/lib/supabase/server";
import { AnonymizeButton } from "./anonymize-button";

type Event = { id: number; acao: string; campos: string[] | null; usuario_id: string | null; created_at: string };

// Export (art. 15/20), anonymisation (art. 17) and the record of both, from the audit log.
export async function RgpdPanel({ kind, id, nome, anonimizadoEm }: { kind: PersonKind; id: string; nome: string; anonimizadoEm: string | null }) {
  const t = await getTranslations("rgpd");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data } = await supabase
    .from("audit_log")
    .select("id, acao, campos, usuario_id, created_at")
    .eq("tabela", personTable[kind])
    .eq("registro_id", id)
    .or("acao.eq.EXPORT,campos.cs.{anonimizado_em}")
    .order("created_at", { ascending: false })
    .limit(20);
  const events = (data ?? []) as Event[];

  const adminIds = [...new Set(events.map((e) => e.usuario_id).filter((v): v is string => !!v))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("id, nome").in("id", adminIds)
    : { data: [] as { id: string; nome: string }[] };
  const adminName = new Map((admins ?? []).map((a) => [a.id, a.nome]));

  const when = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
  const exportUrl = (formato: "json" | "csv") => `${personPath[kind]}/${id}/exportar?formato=${formato}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {anonimizadoEm ? (
          <p className="text-sm text-muted-foreground">{t("anonymizedOn", { date: when(anonimizadoEm) })}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t("exportHint")}</p>
              <div className="flex flex-wrap gap-2">
                {(["json", "csv"] as const).map((formato) => (
                  <Button key={formato} variant="outline" render={<a href={exportUrl(formato)} download />} nativeButton={false}>
                    <Download aria-hidden />
                    {t("export", { format: formato.toUpperCase() })}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">{t("anonymizeHint")}</p>
              <div>
                <AnonymizeButton kind={kind} id={id} nome={nome} />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">{t("log")}</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("logEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {e.acao === "EXPORT" ? t("logExport", { format: (e.campos?.[0] ?? "").toUpperCase() }) : t("logAnonymize")}
                    <span className="text-muted-foreground"> · {(e.usuario_id && adminName.get(e.usuario_id)) || t("unknownAdmin")}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">{when(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
