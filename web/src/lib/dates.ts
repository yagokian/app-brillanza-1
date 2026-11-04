// Plain calendar dates (YYYY-MM-DD), computed in UTC so they never shift with the server's zone.
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Weeks start on Monday, as in Spain.
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

// Postgres interval ("02:30:00") <-> minutes.
export function intervalToMinutes(value: string | null | undefined) {
  const match = value?.match(/^(\d+):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatMinutes(minutes: number | null) {
  if (minutes == null) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
