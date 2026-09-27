import "./load-env";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres, { type Sql } from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import * as schema from "./schema";
import { env } from "@/lib/env";
import { closeSandboxClients, createRoutingClient } from "./sandbox-router";

export type Db = ReturnType<typeof drizzlePostgres<typeof schema>>;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | DbTransaction;

/** `db` routes demo visitors to their sandbox (DEMO_MODE only); `publicDb` never does. */
type Connection = { db: Db; publicDb: Db; client?: Sql; close: () => Promise<void> };
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
    const shared = drizzlePostgres(client, { schema });
    if (!env.DEMO_MODE) return { db: shared, publicDb: shared, client, close: () => client.end() };
    // Every real store stops at the line above: demo routing never runs there.
    return {
      db: drizzlePostgres(createRoutingClient(client), { schema }),
      publicDb: shared,
      client,
      close: async () => {
        await closeSandboxClients();
        await client.end();
      },
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
  const shared = drizzlePglite(client, { schema }) as unknown as Db;
  return { db: shared, publicDb: shared, close: () => client.close() };
}

const globalForDb = globalThis as unknown as { __attarConnection?: Connection };
function getConnection() {
  return (globalForDb.__attarConnection ??= buildConnection());
}
const forward = (pick: (connection: Connection) => Db) =>
  new Proxy({} as Db, {
    get(_target, property) {
      const client = pick(getConnection());
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });

/** Always import this shared client. PGlite is the zero-account local default. */
export const db = forward((connection) => connection.db);
/**
 * Auth, sessions, rate limits and the demo sandbox registry: always the public
 * schema, even for a demo visitor. The same client as `db` unless DEMO_MODE.
 */
export const publicDb = forward((connection) => connection.publicDb);
/** The raw postgres.js client (demo sandbox DDL). Postgres only. */
export const publicSql = () => {
  const { client } = getConnection();
  if (!client) throw new Error("Needs a Postgres DATABASE_URL.");
  return client;
};
/** Standalone scripts must flush PGlite and release Postgres connections before exiting. */
export const closeDb = async () => {
  if (globalForDb.__attarConnection) {
    await globalForDb.__attarConnection.close();
    globalForDb.__attarConnection = undefined;
  }
};
