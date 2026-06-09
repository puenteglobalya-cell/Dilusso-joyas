// Normalize bank statement descriptions for dedup comparisons.
// Removes non-ASCII characters (e.g. U+E9D7 chr(59863) appended by some OCA PDFs)
// and trims whitespace.
export function normalizeDesc(s: string | null): string {
  return (s ?? "").trim().replace(/[^\x00-\x7F]/g, "").trim();
}

export function hasNonAscii(s: string | null): boolean {
  return /[^\x00-\x7F]/.test(s ?? "");
}
