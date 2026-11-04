"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CHECKLIST_ITEMS } from "@/lib/servicos";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean };

const id = z.uuid();
const observacoes = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().max(2000).nullable());
const checklist = z.partialRecord(z.enum(CHECKLIST_ITEMS), z.boolean());

// Every action goes through a security-definer RPC that only touches the colaboradora's own services.
async function call(fn: string, args: Record<string, unknown>, servicoId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error || data !== true) return { ok: false };
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${servicoId}`);
  return { ok: true };
}

export async function iniciarServico(rawId: string): Promise<Result> {
  await requireUser({ role: "worker" });
  const parsed = id.safeParse(rawId);
  if (!parsed.success) return { ok: false };
  return call("rpc_iniciar_servico", { p_id: parsed.data }, parsed.data);
}

export async function finalizarServico(rawId: string, rawObs: string): Promise<Result> {
  await requireUser({ role: "worker" });
  const parsed = z.object({ id, obs: observacoes }).safeParse({ id: rawId, obs: rawObs });
  if (!parsed.success) return { ok: false };
  return call("rpc_finalizar_servico", { p_id: parsed.data.id, p_observacoes: parsed.data.obs }, parsed.data.id);
}

export async function salvarObservacoes(rawId: string, rawObs: string): Promise<Result> {
  await requireUser({ role: "worker" });
  const parsed = z.object({ id, obs: observacoes }).safeParse({ id: rawId, obs: rawObs });
  if (!parsed.success) return { ok: false };
  return call("rpc_salvar_observacoes", { p_id: parsed.data.id, p_observacoes: parsed.data.obs }, parsed.data.id);
}

export async function salvarChecklist(rawId: string, rawChecklist: Record<string, boolean>): Promise<Result> {
  await requireUser({ role: "worker" });
  const parsed = z.object({ id, checklist }).safeParse({ id: rawId, checklist: rawChecklist });
  if (!parsed.success) return { ok: false };
  return call("rpc_salvar_checklist", { p_id: parsed.data.id, p_checklist: parsed.data.checklist }, parsed.data.id);
}
