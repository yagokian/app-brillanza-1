// Shared by server and client components.
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatMoney(value: number | string | null | undefined, locale: string) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(Number(value));
}

// Plain dates (YYYY-MM-DD) are formatted in UTC so they never shift a day.
export function formatDate(value: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
