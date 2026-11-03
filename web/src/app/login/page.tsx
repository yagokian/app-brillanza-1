import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const { erro } = await searchParams;

  return (
    <AuthShell footer={<p className="text-center text-xs text-muted-foreground">{t("privacyNotice")}</p>}>
      <LoginForm inactive={erro === "inativo"} />
    </AuthShell>
  );
}
