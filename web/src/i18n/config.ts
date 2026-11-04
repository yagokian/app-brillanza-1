export const locales = ["es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
