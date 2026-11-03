import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = { title: "Privacidad" };

const SECTIONS = ["controller", "data", "purposes", "legalBasis", "recipients", "retention", "rights", "security", "cookies"] as const;

// Public privacy notice (art. 13 RGPD), reachable from the login screen and the app menu.
export default async function PrivacidadPage() {
  const t = await getTranslations("privacy");
  const values = { company: EMPRESA.nome, nif: EMPRESA.nif, address: EMPRESA.endereco, email: EMPRESA.email };

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
          <LanguageSwitcher />
        </div>
        <BrandLogo className="max-h-16 self-start" />
        <article className="flex flex-col gap-6 rounded-xl border bg-background p-5 md:p-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("updated")}</p>
          </header>
          {SECTIONS.map((key) => (
            <section key={key} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{t(`${key}.title`)}</h2>
              {t(`${key}.body`, values)
                .split("\n")
                .map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
