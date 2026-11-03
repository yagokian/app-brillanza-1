import "server-only";
import { ANEXO_MAX_BYTES, TIPOS_ANEXO } from "@/lib/financeiro";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Kind = { mime: string; ext: string };

// The type comes from the file's first bytes, never from the name or the browser's claim.
function sniff(bytes: Uint8Array): Kind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

// Display name only: no path parts or control characters.
const cleanName = (name: string) =>
  name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255) || "documento";

export type UploadResult = { ok: true; id: string } | { ok: false; error: "arquivo_invalido" | "arquivo_grande" | "failed" };

// Uploads to the private bucket under a random internal name, then registers it in fin_anexos.
// If the registration fails the file is removed again.
export async function uploadAnexo(
  supabase: Supabase,
  file: File,
  { documentoId, movimentoId = null, tipo }: { documentoId: string; movimentoId?: string | null; tipo: string },
): Promise<UploadResult> {
  if (!(TIPOS_ANEXO as readonly string[]).includes(tipo) || file.size === 0) return { ok: false, error: "arquivo_invalido" };
  if (file.size > ANEXO_MAX_BYTES) return { ok: false, error: "arquivo_grande" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { ok: false, error: "arquivo_invalido" };

  const path = `${documentoId}/${crypto.randomUUID()}.${kind.ext}`;
  const bucket = supabase.storage.from("financeiro");
  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (uploadError) {
    console.warn(`[anexos] upload failed: ${uploadError.message}`);
    return { ok: false, error: "failed" };
  }

  const { data, error } = await supabase.rpc("rpc_fin_registrar_anexo", {
    p_documento_id: documentoId,
    p_movimento_id: movimentoId,
    p_tipo: tipo,
    p_nome_original: cleanName(file.name),
    p_caminho: path,
    p_mime: kind.mime,
    p_tamanho: file.size,
  });
  if (error || !data) {
    await bucket.remove([path]);
    return { ok: false, error: "failed" };
  }
  return { ok: true, id: data as string };
}
