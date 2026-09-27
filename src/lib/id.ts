/** URL-safe, cryptographically random 126-bit identifiers. Works in Node and browsers. */
export function createId(): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";
  return Array.from(crypto.getRandomValues(new Uint8Array(21)), (byte) => alphabet[byte & 63]).join("");
}
