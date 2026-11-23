/**
 * A spreadsheet runs a cell that starts with = + - @ (or a tab / carriage return) as a formula, so a customer or product named
 * `=HYPERLINK(...)` would run when someone opens the export (security review SEC-13). Such text gets a leading apostrophe, which
 * shows the text as typed. Numbers, negative amounts included, are left alone.
 */
export function neutralise(value: string): string {
  if (!/^[=+\-@\t\r]/.test(value)) return value;
  if (/^[+-]?\d+(\.\d+)?$/.test(value)) return value;
  return `'${value}`;
}
