"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formValues, invalidFields, requiredText } from "@/lib/form";
import { createAdminClient, temporaryPassword } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UsuarioState =
  | { error: "invalid" | "failed" | "noSecretKey" | "emailExists"; fields?: string[]; values?: Record<string, string> }
  | { created: { email: string; password: string } }
  | undefined;

const schema = z.object({
  nome: requiredText(200),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email().max(254)),
  idioma: z.enum(["es", "pt"]).catch("es"),
});
const idSchema = z.uuid();

// Admin creates the login of a person with the 'financeiro' role. The database trigger creates
// the profile as 'worker'; only the service client (after requireUser admin) promotes it.
export async function criarUsuarioFinanceiro(_prev: UsuarioState, formData: FormData): Promise<UsuarioState> {
  await requireUser({ role: "admin" });
  const values = formValues(formData);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };
  const admin = createAdminClient();
  if (!admin) return { error: "noSecretKey", values };

  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome },
  });
  if (error || !data.user) return { error: error?.code === "email_exists" ? "emailExists" : "failed", values };

  const { error: profileError } = await admin
    .from("profiles")
    .update({ nome: parsed.data.nome, idioma: parsed.data.idioma, tipo: "financeiro", deve_trocar_senha: true })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "failed", values };
  }
  revalidatePath("/financeiro/usuarios");
  return { created: { email: parsed.data.email, password } };
}

// Turns access on or off: the profile flag blocks the app, the ban blocks new sign-ins.
export async function setUsuarioAtivo(id: string, ativo: boolean): Promise<{ ok: boolean }> {
  await requireUser({ role: "admin" });
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ativo: !!ativo })
    .eq("id", id)
    .eq("tipo", "financeiro")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false };
  await createAdminClient()?.auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : "876000h" });
  revalidatePath("/financeiro/usuarios");
  return { ok: true };
}

export async function novaSenhaFinanceiro(id: string): Promise<{ ok: true; email: string; password: string } | { ok: false; error: "failed" | "noSecretKey" }> {
  await requireUser({ role: "admin" });
  if (!idSchema.safeParse(id).success) return { ok: false, error: "failed" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "noSecretKey" };
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", id).eq("tipo", "financeiro").eq("ativo", true).maybeSingle();
  if (!profile) return { ok: false, error: "failed" };

  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.updateUserById(id, { password });
  if (error || !data.user?.email) return { ok: false, error: "failed" };
  await admin.from("profiles").update({ deve_trocar_senha: true }).eq("id", id);
  return { ok: true, email: data.user.email, password };
}
