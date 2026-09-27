import { networkInterfaces } from "node:os";

/**
 * This machine's own private-network IPv4 addresses (e.g. 192.168.0.12), so a
 * phone on the same Wi-Fi can use `pnpm dev`: next.config.ts lets them load
 * dev scripts and Better Auth accepts admin sign-in from them. Development
 * only; production returns nothing and trusts NEXT_PUBLIC_APP_URL alone.
 */
export function lanAddresses(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address)
    .filter((ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip));
}

/** Origins for Better Auth's trustedOrigins, on the port dev is serving. */
export function lanOrigins(): string[] {
  const port = process.env.PORT ?? "3000";
  return lanAddresses().map((ip) => `http://${ip}:${port}`);
}
