"use server";

import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ChangePasswordState = { error?: "tooShort" | "mismatch" | "weak" | "failed" } | undefined;

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser({ allowPendingPassword: true });
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 10 || password.length > 200) return { error: "tooShort" };
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "failed" };

  const { error: flagError } = await supabase.rpc("rpc_concluir_troca_senha");
  if (flagError) return { error: "failed" };

  redirect(homeFor(user.tipo));
}
