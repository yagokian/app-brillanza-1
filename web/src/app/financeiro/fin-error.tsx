"use client";

import { useLocale, useTranslations } from "next-intl";
import { FormError } from "@/components/form-fields";
import type { FinError } from "@/lib/financeiro";
import { formatMoney } from "@/lib/format";

// Database error code -> sentence. The detail carries the amount (balance or installment sum).
export function finErrorText(t: ReturnType<typeof useTranslations<"finance">>, locale: string, error: FinError, detail?: string) {
  const amount = detail && /^-?\d+(\.\d+)?$/.test(detail) ? formatMoney(detail, locale) : "";
  return t(`errors.${error}`, { amount });
}

export function FinErrorMessage({ error, detail }: { error: FinError; detail?: string }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  return <FormError>{finErrorText(t, locale, error, detail)}</FormError>;
}
