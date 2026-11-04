// Cells that a spreadsheet would read as a formula get a leading quote (CSV injection).
export function cell(value: string | number | null | undefined) {
  if (value == null) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && typeof value === "string") text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Decimal comma, as Excel expects in Spain and Portugal.
export const decimal = (value: number | null) => (value == null ? "" : value.toFixed(2).replace(".", ","));

// BOM so Excel opens it as UTF-8; ";" because "," is the decimal separator.
export const toCsv = (rows: (string | number | null | undefined)[][]) =>
  "﻿" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
