import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { publicDb } from "@/db";
import * as schema from "@/db/schema";
import { authSecret, env } from "@/lib/env";
import { authRateLimitStorage } from "@/lib/rate-limit";
import { lanOrigins } from "@/lib/dev-origins";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(publicDb, { provider: "pg", schema }),
    baseURL: env.NEXT_PUBLIC_APP_URL,
    // Dev only (empty in production): sign in from a phone on the same Wi-Fi.
    trustedOrigins: lanOrigins(),
    secret: authSecret(),
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "admin", input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } },
      customStorage: authRateLimitStorage,
    },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
