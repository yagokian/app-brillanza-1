import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// No locale in the URL: the choice lives in a cookie (synced with the user's profile),
// falling back to the browser language, then Spanish.
async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  const preferred = accept.split(",").map((part) => part.trim().slice(0, 2).toLowerCase());
  return preferred.find(isLocale) ?? defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    timeZone: "Europe/Madrid",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
