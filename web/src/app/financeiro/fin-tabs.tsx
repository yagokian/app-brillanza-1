"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs: { href: string; key: "finDashboard" | "payables" | "receivables" | "results" | "registers"; exact?: boolean }[] = [
  { href: "/financeiro", key: "finDashboard", exact: true },
  { href: "/financeiro/pagar", key: "payables" },
  { href: "/financeiro/receber", key: "receivables" },
  { href: "/financeiro/resultados", key: "results" },
  { href: "/financeiro/cadastros", key: "registers" },
];

// Sub-navigation of the financial module for admins (whose main menu has a single "Financial" item).
export function FinTabs({ admin }: { admin?: boolean }) {
  const t = useTranslations("nav");
  const tf = useTranslations("finance");
  const pathname = usePathname();
  const items = [...tabs.map((tab) => ({ ...tab, label: t(tab.key) })), ...(admin ? [{ href: "/financeiro/usuarios", exact: false, label: tf("users.title") }] : [])];

  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
              active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
