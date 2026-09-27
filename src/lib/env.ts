import { z } from "zod";

/**
 * Server environment variables, validated at first import.
 *
 * Design principle: EVERYTHING here is optional in development. A fresh
 * `git clone && pnpm install && pnpm db:push && pnpm db:seed && pnpm dev`
 * must work with no `.env` file at all (PGlite + console notifications +
 * local file storage). Production requirements are enforced conditionally.
 *
 * Never import this file from client components.
 */

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    /**
     * Postgres connection string (Neon, Supabase, or any Postgres).
     * When absent, an embedded PGlite database is used at `.data/pglite`
     * — zero setup, perfect for local development.
     */
    DATABASE_URL: z.string().startsWith("postgres").optional(),
    /**
     * Direct (non-pooled) connection string. Only used with DEMO_MODE: each
     * visitor sandbox gets a tiny connection whose search_path is its schema,
     * which Neon's pooler doesn't allow. Defaults to DATABASE_URL.
     */
    DATABASE_URL_DIRECT: z.string().startsWith("postgres").optional(),

    /**
     * Public showcase deployments only: visitors get a private, expiring copy
     * of the store and a demo admin login (docs/deploy/public-demo.md). Never
     * enable it on a real store.
     */
    DEMO_MODE: z
      .enum(["true", "false", ""])
      .default("false")
      .transform((value) => value === "true"),

    /** Absolute URL of the deployed site. */
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),

    /** Secret for admin session signing (Better Auth). Required in production. */
    BETTER_AUTH_SECRET: z.string().min(16).optional(),

    /** Credentials for the seeded admin account (used by `pnpm db:seed`). */
    ADMIN_EMAIL: z.email().default("admin@example.com"),
    ADMIN_PASSWORD: z.string().min(8).default("admin1234"),

    /* ----------------------- Notifications adapter ----------------------- */
    /** How the shop team is notified of new orders. */
    NOTIFY_ADAPTER: z
      .enum(["console", "resend", "telegram"])
      .default("console"),
    /** Required when NOTIFY_ADAPTER=resend. */
    RESEND_API_KEY: z.string().optional(),
    NOTIFY_EMAIL_FROM: z.email().optional(),
    NOTIFY_EMAIL_TO: z.email().optional(),
    /** Required when NOTIFY_ADAPTER=telegram. */
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    /* ------------------------- Storage adapter --------------------------- */
    /**
     * Where uploaded product images live.
     * "local"  -> public/uploads (dev & self-hosted servers only;
     *             serverless filesystems are read-only, use "s3" there)
     * "s3"     -> any S3-compatible bucket (Cloudflare R2, Supabase Storage,
     *             AWS S3, MinIO)
     */
    STORAGE_ADAPTER: z.enum(["local", "s3"]).default("local"),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Public base URL that serves objects from the bucket. */
    S3_PUBLIC_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (env.NODE_ENV === "production") {
      if (!env.BETTER_AUTH_SECRET)
        fail(
          "BETTER_AUTH_SECRET",
          "Required in production. Generate one with: openssl rand -hex 32",
        );
      if (!env.DATABASE_URL)
        fail("DATABASE_URL", "Required in production (PGlite is dev-only).");
      // The URL decides admin cookie security, upload origin checks and alert links.
      const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
      if (!process.env.NEXT_PUBLIC_APP_URL)
        fail("NEXT_PUBLIC_APP_URL", "Required in production: your store's public https:// URL.");
      else if (appUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname))
        fail("NEXT_PUBLIC_APP_URL", "Must use https:// in production so admin cookies are Secure.");
    }

    if (env.DEMO_MODE) {
      // Sandboxes are Postgres schemas; the embedded PGlite has one connection.
      if (!env.DATABASE_URL)
        fail("DEMO_MODE", "DEMO_MODE needs a Postgres DATABASE_URL.");
      else if (/-pooler\./.test(new URL(env.DATABASE_URL).hostname) && !env.DATABASE_URL_DIRECT)
        fail("DATABASE_URL_DIRECT", "Required with DEMO_MODE on Neon: the same URL without -pooler.");
    }

    if (env.NOTIFY_ADAPTER === "resend") {
      if (!env.RESEND_API_KEY)
        fail("RESEND_API_KEY", "Required when NOTIFY_ADAPTER=resend");
      if (!env.NOTIFY_EMAIL_FROM)
        fail("NOTIFY_EMAIL_FROM", "Required when NOTIFY_ADAPTER=resend");
      if (!env.NOTIFY_EMAIL_TO)
        fail("NOTIFY_EMAIL_TO", "Required when NOTIFY_ADAPTER=resend");
    }

    if (env.NOTIFY_ADAPTER === "telegram") {
      if (!env.TELEGRAM_BOT_TOKEN)
        fail("TELEGRAM_BOT_TOKEN", "Required when NOTIFY_ADAPTER=telegram");
      if (!env.TELEGRAM_CHAT_ID)
        fail("TELEGRAM_CHAT_ID", "Required when NOTIFY_ADAPTER=telegram");
    }

    if (env.STORAGE_ADAPTER === "s3") {
      for (const key of [
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_PUBLIC_URL",
      ] as const) {
        if (!env[key]) fail(key, `Required when STORAGE_ADAPTER=s3`);
      }
    }
  });

let validated: z.infer<typeof envSchema> | undefined;
function getEnv() {
  if (validated) return validated;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error));
    throw new Error(
      "Invalid environment variables. See errors above and compare with .env.example",
    );
  }
  return (validated = parsed.data);
}

/** Signs admin sessions and demo sandbox cookies. The fallback is for local development only. */
export const authSecret = () =>
  env.BETTER_AUTH_SECRET ?? "attar-local-development-secret-change-before-deploying";

/** Validate on first use, so a build can compile dynamic routes without production credentials. */
export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, property) {
    return Reflect.get(getEnv(), property);
  },
});
