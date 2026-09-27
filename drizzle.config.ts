import "./src/db/load-env";
import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";

const useRemote = !!process.env.DATABASE_URL;

// PGlite can't create parent directories itself.
if (!useRemote) mkdirSync("./.data", { recursive: true });

/**
 * Drizzle Kit configuration.
 * - With DATABASE_URL set: targets the remote Postgres (Neon/Supabase/etc).
 * - Without: targets the embedded PGlite database in .data/pglite.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  ...(useRemote
    ? { dbCredentials: { url: process.env.DATABASE_URL! } }
    : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
  verbose: true,
  // Safe creates must bootstrap noninteractively; destructive pushes still prompt.
  strict: false,
});
