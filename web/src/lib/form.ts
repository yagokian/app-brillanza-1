import { z } from "zod";

// Shared shape for admin form actions. Values go back to the form so a failed save keeps what was typed.
export type FormState =
  | { ok?: false; error: "invalid" | "failed" | string; fields?: string[]; values?: Record<string, string> }
  | undefined;

const trimmed = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null);

// Empty inputs become null, so clearing a field clears the column.
export const optionalText = (max = 500) => z.preprocess(trimmed, z.string().max(max).nullable());
export const requiredText = (max = 200) => z.preprocess(trimmed, z.string().min(1).max(max));
export const optionalEmail = z.preprocess((v) => (typeof trimmed(v) === "string" ? String(trimmed(v)).toLowerCase() : null), z.email().max(254).nullable());
export const optionalDate = z.preprocess(trimmed, z.iso.date().nullable());
export const optionalMoney = z.preprocess(
  (v) => (trimmed(v) == null ? null : Number(String(v).replace(",", "."))),
  z.number().min(0).max(99999).nullable(),
);
export const billingType = z.preprocess(trimmed, z.enum(["hora", "diaria", "fixo"]).nullable());

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function invalidFields(error: z.ZodError) {
  return [...new Set(error.issues.map((issue) => String(issue.path[0])))];
}
