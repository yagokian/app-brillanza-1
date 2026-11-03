"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { billingType, formValues, invalidFields, optionalMoney, optionalText, type FormState } from "@/lib/form";
import { SERVICE_STATUSES } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

const schema = z
  .object({
    cliente_id: z.uuid(),
    colaboradora_id: optionalUuid,
    data_servico: z.iso.date(),
    hora_inicio_prevista: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{2}:\d{2}$/).nullable()),
    duracao_minutos: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().int().min(15).max(24 * 60).nullable()),
    tipo_cobranca_cliente: billingType,
    valor_cliente: optionalMoney,
    tipo_pagamento_colaboradora: billingType,
    valor_colaboradora: optionalMoney,
    status: z.enum(SERVICE_STATUSES),
    motivo_cancelamento: optionalText(500),
  })
  .transform(({ duracao_minutos, ...rest }) => ({
    ...rest,
    duracao_estimada: duracao_minutos == null ? null : `${duracao_minutos} minutes`,
    motivo_cancelamento: rest.status === "cancelado" ? rest.motivo_cancelamento : null,
  }));

export async function saveServico(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser({ role: "admin" });
  const values = formValues(formData);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", fields: invalidFields(parsed.error), values };

  const supabase = await createClient();
  const rawId = formData.get("id");
  if (rawId) {
    const id = z.uuid().safeParse(rawId);
    if (!id.success) return { error: "failed", values };
    const { data, error } = await supabase.from("servicos").update(parsed.data).eq("id", id.data).select("id");
    if (error || !data?.length) return { error: "failed", values };
  } else {
    const { error } = await supabase.from("servicos").insert(parsed.data);
    if (error) return { error: "failed", values };
  }

  revalidatePath("/admin/agenda");
  redirect(`/admin/agenda?d=${parsed.data.data_servico}`);
}

export type ServicoResult = { ok: true } | { ok: false; error: "started" | "invalid" | "failed" };

// Quick cancel from the day panel. Finished or already cancelled services stay as they are.
export async function cancelarServico(id: string, motivo: string): Promise<ServicoResult> {
  await requireUser({ role: "admin" });
  const text = typeof motivo === "string" ? motivo.trim().slice(0, 500) : "";
  if (!z.uuid().safeParse(id).success || !text) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("servicos")
    .update({ status: "cancelado", motivo_cancelamento: text })
    .eq("id", id)
    .in("status", ["agendado", "em_andamento"])
    .select("id");
  if (error || !data?.length) return { ok: false, error: "failed" };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// Deletes a service created by mistake. The database only allows it if the service never
// started (trigger bloquear_exclusao); the deletion is kept in audit_log.
export async function excluirServico(id: string): Promise<ServicoResult> {
  await requireUser({ role: "admin" });
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("servicos").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message === "servico_iniciado" ? "started" : "failed" };
  if (!data?.length) return { ok: false, error: "failed" };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
