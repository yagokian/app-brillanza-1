import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  History,
  LayoutDashboard,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export type NavItem = {
  href: string;
  labelKey: "dashboard" | "schedule" | "clients" | "workers" | "reports" | "today" | "history";
  icon: LucideIcon;
  exact?: boolean;
};

export const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/agenda", labelKey: "schedule", icon: CalendarDays },
    { href: "/admin/clientes", labelKey: "clients", icon: Users },
    { href: "/admin/trabajadoras", labelKey: "workers", icon: UserRoundCheck },
    { href: "/admin/informes", labelKey: "reports", icon: BarChart3 },
  ],
  worker: [
    { href: "/agenda", labelKey: "today", icon: CalendarCheck, exact: true },
    { href: "/agenda/historial", labelKey: "history", icon: History },
  ],
};

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
