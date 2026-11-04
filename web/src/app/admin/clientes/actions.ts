"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  billingType,
  formValues,
  invalidFields,
  optionalDate,
  optionalEmail,
  optionalMoney,
  optionalText,
  requiredText,
  type FormState,
} from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  nome: requiredText(200),
  telefone: optionalText(40),
  email: optionalEmail,
  endereco: optionalText(300),
  codigo_postal: optionalText(10),
  cidade: optionalText(100),
  data_contratacao: optionalDate,
  tipo_servico: optionalText(200),
  frequencia: optionalText(100),
  duracao_horario: optionalText(100),
  dia_semana: optionalText(100),
  tipo_cobranca: billingType,
  valor_acordado: optionalMoney,
  observacoes: optionalText(2000),
  notas_para_colaboradora: optionalText(2000),
  base_legal: z.enum(["contrato", "consentimento"]),
  aviso_privacidade_em: optionalDate,
});

const idSchema = z.uuid();

export async function saveCliente(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser({ role: "admin" });
  const values = formValues(formData);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };

  const supabase = await createClient();
  const rawId = formData.get("id");
  let id: string;

  if (rawId) {
    const idParsed = idSchema.safeParse(rawId);
    if (!idParsed.success) return { error: "failed", values };
    id = idParsed.data;
    // Anonymised clients stay frozen.
    const { data, error } = await supabase
      .from("clientes")
      .update(parsed.data)
      .eq("id", id)
      .is("anonimizado_em", null)
      .select("id");
    if (error || !data?.length) return { error: "failed", values };
  } else {
    const { data, error } = await supabase.from("clientes").insert(parsed.data).select("id").single();
    if (error || !data) return { error: "failed", values };
    id = data.id;
  }

  revalidatePath("/admin/clientes");
  redirect(`/admin/clientes/${id}`);
}

// Right to erasure (art. 17 RGPD). The audit log records who did it and when.
export async function anonimizarCliente(id: string): Promise<{ ok: boolean; error?: "noSecretKey" }> {
  await requireUser({ role: "admin" });
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_admin_anonimizar_cliente", { p_id: parsed.data });
  if (error || data !== true) return { ok: false };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${parsed.data}`);
  return { ok: true };
}
