import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";

export type Role = "admin" | "worker" | "financeiro";

// Roles with access to the financial module.
export const FIN_ROLES: Role[] = ["admin", "financeiro"];

export type CurrentUser = {
  id: string;
  email: string | null;
  nome: string;
  tipo: Role;
  idioma: Locale;
  deveTrocarSenha: boolean;
  // Authenticator assurance level of the session: aal2 = password + TOTP code.
  aal: "aal1" | "aal2";
};

export const homeFor = (role: Role) => (role === "admin" ? "/admin" : role === "financeiro" ? "/financeiro" : "/agenda");

// Admins and the finance role always sign in with 2FA (TOTP).
export const needsMfa = (role: Role) => role === "admin" || role === "financeiro";

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
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

type RequireOptions = { role?: Role | Role[]; allowPendingPassword?: boolean };

export async function requireUser({ role, allowPendingPassword = false }: RequireOptions = {}) {
  const user = await getCurrentUser();
  // Signed in but without an active profile: end the session instead of looping on /login.
  if (!user) redirect("/auth/sair?motivo=inativo");
  // Admins and the finance role always need 2FA: /verificacion enrols the TOTP factor or asks for the code.
  // The database enforces the same rule (private.is_admin() and private.is_financeiro() require aal2).
  if (needsMfa(user.tipo) && user.aal !== "aal2") redirect("/verificacion");
  if (user.deveTrocarSenha && !allowPendingPassword) redirect("/cambiar-contrasena");
  if (role && !(Array.isArray(role) ? role : [role]).includes(user.tipo)) redirect(homeFor(user.tipo));
  return user;
}
