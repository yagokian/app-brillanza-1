"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { locales } from "@/i18n/config";
import { setLocale } from "@/app/locale-actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations();
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn("inline-flex items-center gap-1 rounded-lg border bg-background p-1 text-sm", className)}
    >
      <Languages className="mx-1 size-4 text-muted-foreground" aria-hidden />
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          aria-pressed={current === locale}
          title={t(`languages.${locale}`)}
          onClick={() => startTransition(() => setLocale(locale))}
          className={cn(
            "rounded-md px-2 py-1 font-medium uppercase transition-colors",
            current === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
