import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The demo sandbox cookie: `<sandbox id>.<expiry ms>.<HMAC>`. The HMAC also
 * covers the visitor's admin session cookie, so the sandbox cookie is useless
 * without that session and can't be moved to another one. Verifying it needs
 * no database round trip, which matters because it runs before every query.
 */
export const SANDBOX_COOKIE = "attar_sandbox";
export const sandboxIdPattern = /^[a-z0-9]{16}$/;
export const sandboxSchema = (id: string) => {
  if (!sandboxIdPattern.test(id)) throw new Error("Invalid sandbox id.");
  return `demo_${id}`;
};

const mac = (secret: string, id: string, expires: number, session: string) =>
  createHmac("sha256", secret)
    .update(`${id}.${expires}.${createHash("sha256").update(session).digest("hex")}`)
    .digest("base64url");

export function signSandboxCookie(secret: string, id: string, expires: Date, session: string) {
  sandboxSchema(id);
  const at = expires.getTime();
  return `${id}.${at}.${mac(secret, id, at, session)}`;
}

/** The sandbox id, or null for a missing, malformed, forged, expired or unbound cookie. */
export function verifySandboxCookie(secret: string, value: string | undefined, session: string | null | undefined, now = Date.now()) {
  if (!value || !session || value.length > 200) return null;
  const [id, at, signature, extra] = value.split(".");
  if (extra !== undefined || !sandboxIdPattern.test(id ?? "") || !/^\d{1,15}$/.test(at ?? "")) return null;
  const expires = Number(at);
  if (expires <= now) return null;
  const expected = Buffer.from(mac(secret, id, expires, session));
  const given = Buffer.from(signature ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** Reads one cookie from a Cookie header without pulling in a parser. */
export function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0 || part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
