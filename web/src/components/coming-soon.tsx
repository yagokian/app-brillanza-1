import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder for sections built in the next phases.
export async function ComingSoon({ titleKey }: { titleKey: "schedule" | "clients" | "workers" | "reports" | "history" }) {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${titleKey}`)} />
      <Card>
        <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
          <Construction className="size-5 shrink-0" aria-hidden />
          {t("common.comingSoon")}
        </CardContent>
      </Card>
    </>
  );
}
