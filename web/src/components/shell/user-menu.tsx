"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <form action="/auth/sair" method="post" className={className}>
      <Button type="submit" variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
        <LogOut className="size-4" aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}

export function PrivacyLink({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Button variant="ghost" render={<Link href="/privacidad" />} nativeButton={false} className={cn("justify-start gap-3 text-muted-foreground", className)}>
      <ShieldCheck className="size-4" aria-hidden />
      {t("privacy")}
    </Button>
  );
}

// Admins only: where logins of other admins and of the finance role are managed.
export function UsersLink({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <Button variant="ghost" render={<Link href="/financeiro/usuarios" />} nativeButton={false} className={cn("justify-start gap-3 text-muted-foreground", className)}>
      <UserCog className="size-4" aria-hidden />
      {t("users")}
    </Button>
  );
}

// Phone header: avatar opens a sheet with the account options.
export function MobileUserMenu({ nome, email, admin }: { nome: string; email: string | null; admin?: boolean }) {
  const t = useTranslations("common");
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button type="button" aria-label={t("menu")} className="rounded-full">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">{initials(nome)}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <LanguageSwitcher className="self-start" />
          {admin && <UsersLink />}
          <PrivacyLink />
          <SignOutButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
