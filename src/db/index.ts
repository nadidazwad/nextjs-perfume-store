import "./load-env";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { env } from "@/lib/env";

export type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | DbTransaction;

type Connection = { db: Db; close: () => Promise<void> };
function buildConnection(): Connection {
  if (env.DATABASE_URL) {
    const client = postgres(env.DATABASE_URL, {
      prepare: false,
      // One line instead of the raw notice object; "already exists, skipping"
      // notices from re-running migrations are expected and stay silent.
      onnotice: (notice) => {
        if (!["42P06", "42P07"].includes(notice.code)) console.info(`Postgres: ${notice.message}`);
      },
    });
    return {
      db: drizzlePostgres(client, { schema }),
      close: () => client.end(),
    };
  }
  if (env.NODE_ENV === "production")
    throw new Error(
      "DATABASE_URL is required in production (PGlite is dev-only).",
    );
  mkdirSync("./.data", { recursive: true });
  const client = new PGlite("./.data/pglite");
  // The shared PostgreSQL query/transaction API is identical; only execute's
  // raw result type differs. Use select/returning in portable application code.
  return {
    db: drizzlePglite(client, { schema }) as unknown as Db,
    close: () => client.close(),
  };
}

const globalForDb = globalThis as unknown as { __attarConnection?: Connection };
function getConnection() {
  return (globalForDb.__attarConnection ??= buildConnection());
}

/** Always import this shared client. PGlite is the zero-account local default. */
export const db = new Proxy({} as Db, {
  get(_target, property) {
    const client = getConnection().db;
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
/** Standalone scripts must flush PGlite and release Postgres connections before exiting. */
export const closeDb = async () => {
  if (globalForDb.__attarConnection) {
    await globalForDb.__attarConnection.close();
    globalForDb.__attarConnection = undefined;
  }
};
