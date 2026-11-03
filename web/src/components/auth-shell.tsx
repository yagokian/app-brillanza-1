import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";

// Centered card layout shared by /login and /cambiar-contrasena.
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-muted/40 px-4 py-8">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
        <BrandLogo priority className="mx-auto max-h-24" />
        {children}
        {footer}
      </div>
    </main>
  );
}
