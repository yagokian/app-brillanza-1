"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: "invalid" } | undefined;

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  // Same message for every failure, so the form never reveals which emails exist.
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "invalid" };

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
