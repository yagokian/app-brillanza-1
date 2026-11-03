import { FIN_ROLES, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Attachment download. The file is streamed by the server with the user's own session
// (RLS on fin_anexos and storage.objects), so there is never a public or long-lived URL.
export async function GET(_request: Request, { params }: RouteContext<"/financeiro/anexos/[id]">) {
  await requireUser({ role: FIN_ROLES });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });

  const supabase = await createClient();
  const { data: anexo } = await supabase.from("fin_anexos").select("caminho, mime, nome_original").eq("id", id).maybeSingle();
  if (!anexo) return new Response(null, { status: 404 });
  const { data: file, error } = await supabase.storage.from("financeiro").download(anexo.caminho);
  if (error || !file) return new Response(null, { status: 404 });

  const ascii = anexo.nome_original.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(file, {
    headers: {
      "Content-Type": anexo.mime,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(anexo.nome_original)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
