import { AppShell } from "@/components/shell/app-shell";
import { FIN_ROLES, requireUser } from "@/lib/auth";
import { FinTabs } from "./fin-tabs";

// Financial module: admin and the 'financeiro' role (both with 2FA). Workers are sent home.
export default async function FinanceiroLayout({ children }: LayoutProps<"/financeiro">) {
  const user = await requireUser({ role: FIN_ROLES });
  return (
    <AppShell user={user}>
      {/* The finance role has these links in its own menu; admins get them here. */}
      {user.tipo === "admin" && <FinTabs admin />}
      {children}
    </AppShell>
  );
}
