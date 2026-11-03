import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser({ role: "admin" });
  return <AppShell user={user}>{children}</AppShell>;
}
