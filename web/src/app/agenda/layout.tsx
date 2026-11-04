import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";

export default async function WorkerLayout({ children }: LayoutProps<"/agenda">) {
  const user = await requireUser({ role: "worker" });
  return <AppShell user={user}>{children}</AppShell>;
}
