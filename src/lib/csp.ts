/**
 * Content-Security-Policy. Every response gets the base policy (next.config.ts);
 * pages add a per-request script nonce in src/proxy.ts. Styles aren't restricted:
 * theme colours and ratings use inline style attributes, which nonces can't cover.
 */
export const basePolicy = "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

export function pagePolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return `${basePolicy}; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}`;
}
