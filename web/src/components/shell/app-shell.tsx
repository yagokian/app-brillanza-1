import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/auth";
import { BottomNav, SidebarNav } from "./nav-links";
import { initials } from "@/lib/format";
import { MobileUserMenu, PrivacyLink, SignOutButton, UsersLink } from "./user-menu";

// One layout, two shapes: sidebar on computers (md+), header + bottom tabs on phones.
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/40 md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-sidebar p-4 md:flex">
        <Link href={homeFor(user.tipo)} className="px-2 pt-2">
          <BrandLogo className="max-h-14" />
        </Link>
        <SidebarNav role={user.tipo} />
        <div className="mt-auto flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">{initials(user.nome)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.nome}</p>
              {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </div>
          </div>
          <LanguageSwitcher className="mx-2 self-start" />
          {user.tipo === "admin" && <UsersLink />}
          <PrivacyLink />
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href={homeFor(user.tipo)} className="py-2">
            <BrandLogo className="max-h-10" />
          </Link>
          <MobileUserMenu nome={user.nome} email={user.email} admin={user.tipo === "admin"} />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav role={user.tipo} />
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
