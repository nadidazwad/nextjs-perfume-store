/** Bangladesh mobile numbers only: local 01[3-9]XXXXXXXX or +880 equivalent. */
export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const local = compact.startsWith("+880") ? `0${compact.slice(4)}` : compact;
  if (!/^01[3-9]\d{8}$/.test(local)) throw new Error("Enter a valid Bangladesh mobile number (01XXXXXXXXX).");
  return `+880${local.slice(1)}`;
}

export function isValidPhone(value: string): boolean {
  try { normalizePhone(value); return true; } catch { return false; }
}

export function formatPhone(value: string): string {
  const normalized = normalizePhone(value);
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 8)}-${normalized.slice(8)}`;
}
