import type { NextConfig } from "next";
import { validateStoreConfig } from "./store.config";
import { basePolicy } from "./src/lib/csp";

// Fail dev, build and start on a bad store.config.ts, before any page renders.
validateStoreConfig();

// Safe for every response. Pages get the same policy plus a per-request script
// nonce from src/proxy.ts (src/lib/csp.ts).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: basePolicy },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Checkout and tracking arguments contain customer contact details.
  logging: { serverFunctions: false },
  poweredByHeader: false,
  // The Dockerfile sets NEXT_OUTPUT=standalone for a small self-contained image;
  // Vercel and `pnpm start` use the regular output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
