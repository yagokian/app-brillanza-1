"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { WEEK_DAYS } from "@/lib/colaboradoras";
import { billingType, formValues, invalidFields, optionalEmail, optionalMoney, optionalText, requiredText } from "@/lib/form";
import { createAdminClient, temporaryPassword } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ColaboradoraState =
  | { error: "invalid" | "failed" | "noSecretKey" | "emailExists"; fields?: string[]; values?: Record<string, string> }
  | { created: { id: string; email: string | null; password: string | null } }
  | undefined;

export type AccessResult = { ok: true; email: string; password: string } | { ok: false; error: "failed" | "noSecretKey" | "emailExists" | "noEmail" };

const schema = z.object({
  nome: requiredText(200),
  telefone: optionalText(40),
  email: optionalEmail,
  tipos_de_servico: z.preprocess(
    (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []),
    z.array(z.string().max(100)).max(20),
  ),
  dias_disponiveis: z.array(z.enum(WEEK_DAYS)).max(7),
  tipo_pagamento: billingType,
  valor_pagamento: optionalMoney,
  observacoes: optionalText(2000),
});

const idSchema = z.uuid();
const idiomaSchema = z.enum(["es", "pt"]).catch("es");

function parse(formData: FormData) {
  return schema.safeParse({ ...Object.fromEntries(formData), dias_disponiveis: formData.getAll("dias_disponiveis") });
}

// Creates the login account. The profile is created by the database trigger as 'worker'
// with deve_trocar_senha = true; here we only set the name and language.
async function createLogin(email: string, nome: string, idioma: "es" | "pt") {
  const admin = createAdminClient();
  if (!admin) return { error: "noSecretKey" as const };
  const password = temporaryPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } });
  if (error || !data.user) {
    return { error: error?.code === "email_exists" ? ("emailExists" as const) : ("failed" as const) };
  }
  await admin.from("profiles").update({ nome, idioma, deve_trocar_senha: true }).eq("id", data.user.id);
  return { userId: data.user.id, password };
}

export async function saveColaboradora(_prev: ColaboradoraState, formData: FormData): Promise<ColaboradoraState> {
  await requireUser({ role: "admin" });
  const values = formValues(formData);
  values.dias_disponiveis = formData.getAll("dias_disponiveis").join(",");
  const parsed = parse(formData);
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };
  const input = parsed.data;
  const supabase = await createClient();

  const rawId = formData.get("id");
  if (rawId) {
    const id = idSchema.safeParse(rawId);
    if (!id.success) return { error: "failed", values };
    const { data: current } = await supabase
      .from("colaboradoras")
      .select("user_id, email")
      .eq("id", id.data)
      .is("anonimizado_em", null)
      .maybeSingle();
    if (!current) return { error: "failed", values };

    if (current.user_id) {
      // The login needs an email; changing it here changes the login too.
      if (!input.email) return { error: "invalid", fields: ["email"], values };
      if (input.email !== current.email) {
        const admin = createAdminClient();
        if (!admin) return { error: "noSecretKey", values };
        const { error } = await admin.auth.admin.updateUserById(current.user_id, { email: input.email, email_confirm: true });
        if (error) return { error: error.code === "email_exists" ? "emailExists" : "failed", values };
      }
      await supabase.from("profiles").update({ nome: input.nome }).eq("id", current.user_id);
    }

    const { error } = await supabase.from("colaboradoras").update(input).eq("id", id.data);
    if (error) return { error: "failed", values };
    revalidatePath("/admin/colaboradoras");
    redirect("/admin/colaboradoras");
  }

  let login: { userId: string; password: string } | null = null;
  if (input.email) {
    const result = await createLogin(input.email, input.nome, idiomaSchema.parse(formData.get("idioma")));
    if ("error" in result) return { error: result.error!, values };
    login = result;
  }

  const { data, error } = await supabase
    .from("colaboradoras")
    .insert({ ...input, user_id: login?.userId ?? null })
    .select("id")
    .single();
  if (error || !data) {
    // Don't leave an orphan login behind.
    if (login) await createAdminClient()?.auth.admin.deleteUser(login.userId);
    return { error: "failed", values };
  }

  revalidatePath("/admin/colaboradoras");
  return { created: { id: data.id, email: input.email, password: login?.password ?? null } };
}

// Turns access on or off: the profile flag blocks the app, the ban blocks new sign-ins and token refreshes.
export async function setColaboradoraAtiva(id: string, ativo: boolean): Promise<{ ok: boolean }> {
  await requireUser({ role: "admin" });
  if (!idSchema.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("colaboradoras")
    .update({ ativo: !!ativo })
    .eq("id", id)
    .is("anonimizado_em", null)
    .select("user_id")
    .maybeSingle();
  if (error || !data) return { ok: false };

  if (data.user_id) {
    await supabase.from("profiles").update({ ativo: !!ativo }).eq("id", data.user_id);
    await createAdminClient()?.auth.admin.updateUserById(data.user_id, { ban_duration: ativo ? "none" : "876000h" });
  }
  revalidatePath("/admin/colaboradoras");
  return { ok: true };
}

// New temporary password (or a first login, if she had none). Shown once to the admin.
export async function gerarAcesso(id: string, idiomaRaw?: string): Promise<AccessResult> {
  await requireUser({ role: "admin" });
  if (!idSchema.safeParse(id).success) return { ok: false, error: "failed" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "noSecretKey" };

  const supabase = await createClient();
  const { data: colab } = await supabase
    .from("colaboradoras")
    .select("nome, email, user_id, ativo")
    .eq("id", id)
    .is("anonimizado_em", null)
    .maybeSingle();
  if (!colab || !colab.ativo) return { ok: false, error: "failed" };
  if (!colab.email) return { ok: false, error: "noEmail" };

  if (colab.user_id) {
    const password = temporaryPassword();
    const { error } = await admin.auth.admin.updateUserById(colab.user_id, { password });
    if (error) return { ok: false, error: "failed" };
    await admin.from("profiles").update({ deve_trocar_senha: true }).eq("id", colab.user_id);
    return { ok: true, email: colab.email, password };
  }

  const result = await createLogin(colab.email, colab.nome, idiomaSchema.parse(idiomaRaw));
  if ("error" in result) return { ok: false, error: result.error! };
  const { error } = await supabase.from("colaboradoras").update({ user_id: result.userId }).eq("id", id);
  if (error) {
    await admin.auth.admin.deleteUser(result.userId);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/admin/colaboradoras");
  return { ok: true, email: colab.email, password: result.password };
}

// Right to erasure (art. 17 RGPD): personal data is wiped and the login account deleted.
// Needs the secret key, so the account never outlives the anonymisation.
export async function anonimizarColaboradora(id: string): Promise<{ ok: boolean; error?: "noSecretKey" }> {
  await requireUser({ role: "admin" });
  if (!idSchema.safeParse(id).success) return { ok: false };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "noSecretKey" };

  const supabase = await createClient();
  const { data: current } = await supabase.from("colaboradoras").select("id").eq("id", id).is("anonimizado_em", null).maybeSingle();
  if (!current) return { ok: false };

  const { data: userId, error } = await supabase.rpc("rpc_admin_anonimizar_colaboradora", { p_id: id });
  if (error) return { ok: false };
  if (typeof userId === "string") {
    // The profile was already cleared and deactivated by the RPC; deleting the account removes it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) console.warn(`[anonimizar] login not deleted: ${deleteError.code ?? "unknown"}`);
  }

  revalidatePath("/admin/colaboradoras");
  revalidatePath(`/admin/colaboradoras/${id}`);
  return { ok: true };
}
