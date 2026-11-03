import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Contraseña" };

export default async function ChangePasswordPage() {
  await requireUser({ allowPendingPassword: true });
  return (
    <AuthShell>
      <ChangePasswordForm />
    </AuthShell>
  );
}
