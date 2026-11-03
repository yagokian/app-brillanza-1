import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";

export type Role = "admin" | "worker";

export type CurrentUser = {
  id: string;
  email: string | null;
  nome: string;
  tipo: Role;
  idioma: Locale;
  deveTrocarSenha: boolean;
};

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/agenda");

// Data access layer: the single place that turns the session into a user.
// Deduplicated per request with React's cache().
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, tipo, idioma, ativo, deve_trocar_senha")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile || !profile.ativo) return null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    nome: profile.nome,
    tipo: profile.tipo,
    idioma: profile.idioma,
    deveTrocarSenha: profile.deve_trocar_senha,
  };
});

type RequireOptions = { role?: Role; allowPendingPassword?: boolean };

export async function requireUser({ role, allowPendingPassword = false }: RequireOptions = {}) {
  const user = await getCurrentUser();
  // Signed in but without an active profile: end the session instead of looping on /login.
  if (!user) redirect("/auth/sair?motivo=inativo");
  if (user.deveTrocarSenha && !allowPendingPassword) redirect("/cambiar-contrasena");
  if (role && user.tipo !== role) redirect(homeFor(user.tipo));
  return user;
}
