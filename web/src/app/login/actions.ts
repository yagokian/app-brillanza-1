"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

// The email goes back to the form so it is not wiped after a failed attempt.
export type LoginState = { error?: "invalid"; email?: string } | undefined;

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = schema.safeParse({ email, password: formData.get("password") });
  // Same message for every failure, so the form never reveals which emails exist.
  if (!parsed.success) {
    console.warn("[login] rejected by validation");
    return { error: "invalid", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Server log only (no email or password), to tell apart wrong password, unconfirmed email, etc.
    console.warn(`[login] sign-in failed: ${error.code ?? "unknown"} (status ${error.status ?? "?"})`);
    return { error: "invalid", email };
  }

  // Apply the language saved on the profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("idioma")
    .eq("id", data.user.id)
    .maybeSingle();
  if (isLocale(profile?.idioma)) {
    (await cookies()).set(LOCALE_COOKIE, profile.idioma, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  redirect("/");
}
