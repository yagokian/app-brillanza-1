import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service client (bypasses RLS). Only for creating and managing login accounts,
// always after requireUser({ role: "admin" }). Returns null while the key is not configured.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 14 characters without look-alikes (0/O, 1/l/I), always with upper, lower and a digit.
export function temporaryPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789"];
  const all = sets.join("");
  const pick = (chars: string) => {
    // Rejection sampling keeps every character equally likely.
    const limit = 256 - (256 % chars.length);
    const buf = new Uint8Array(1);
    do crypto.getRandomValues(buf);
    while (buf[0] >= limit);
    return chars[buf[0] % chars.length];
  };
  const out = [...sets.map(pick), ...Array.from({ length: 11 }, () => pick(all))];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
