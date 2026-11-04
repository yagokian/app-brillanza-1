"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, homeFor, needsMfa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type MfaState = { error?: "invalid" } | undefined;

const schema = z.object({
  factorId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
});

// Confirms a TOTP code: on enrolment it verifies the new factor, at sign-in it raises the session to aal2.
export async function verifyMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const user = await getCurrentUser();
  if (!user || !needsMfa(user.tipo)) redirect("/");

  const parsed = schema.safeParse({
    factorId: formData.get("factorId"),
    code: String(formData.get("code") ?? "").replace(/\s/g, ""),
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    console.warn(`[mfa] verify failed: ${error.code ?? "unknown"}`);
    return { error: "invalid" };
  }
  redirect(homeFor(user.tipo));
}
