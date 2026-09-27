import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql } from "postgres";
import { getSessionCookie } from "better-auth/cookies";
import { SANDBOX_COOKIE, readCookie, sandboxSchema, verifySandboxCookie } from "@/lib/demo/cookie";
import { authSecret, env } from "@/lib/env";

/**
 * DEMO_MODE only (src/db/index.ts never loads this otherwise). A stand-in for
 * the postgres.js client that Drizzle wraps: each query and transaction looks
 * at the current request and runs on that visitor's sandbox connection, or on
 * the shared client when there is no valid sandbox cookie. Drizzle calls only
 * `unsafe`, `begin` and (on transaction clients) `savepoint`.
 */

const given = new AsyncLocalStorage<Headers | null>();
/** Run `fn` as if it were a request with these headers (tests; `null` = no request). */
export const withRequestHeaders = <T>(headers: Headers | null, fn: () => T) => given.run(headers, fn);

async function requestHeaders(): Promise<Headers | null> {
  const store = given.getStore();
  if (store !== undefined) return store;
  try {
    const { headers } = await import("next/headers");
    return await headers();
  } catch (error) {
    // Next's own signals (e.g. "this page is dynamic") must propagate.
    const { unstable_rethrow } = await import("next/navigation");
    unstable_rethrow(error);
    return null; // no request: scripts, migrations, seed
  }
}

/** The sandbox this request is routed to, if any. Pure cookie check, no query. */
export async function currentSandboxId(headers?: Headers | null) {
  const source = headers === undefined ? await requestHeaders() : headers;
  if (!source) return null;
  return verifySandboxCookie(authSecret(), readCookie(source.get("cookie"), SANDBOX_COOKIE), getSessionCookie(source));
}

// Whether a sandbox is still in the registry, cached briefly per instance: an
// ended sandbox's visitor becomes an anonymous shopper. (A registered sandbox
// whose schema is gone still fails closed below.)
const LIVE_TTL_MS = 5_000;
const liveness = new Map<string, { live: boolean; until: number }>();
async function isLive(shared: Sql, id: string) {
  const now = Date.now();
  const cached = liveness.get(id);
  if (cached && cached.until > now) return cached.live;
  const rows = await shared`select 1 from public.demo_sandboxes where id = ${id} and expires_at > now()`;
  if (liveness.size >= 1000) liveness.clear();
  liveness.set(id, { live: rows.length > 0, until: now + LIVE_TTL_MS });
  return rows.length > 0;
}

// One connection per sandbox, least recently used closed first. The search_path
// is the sandbox schema alone: once a sandbox is dropped its queries fail
// instead of falling through to the public store tables. It is passed as
// `options`: Neon's proxy silently drops a bare `search_path` startup parameter
// (and its pooler rejects both), so each connection also proves it took effect.
const MAX_CLIENTS = 8;
type Entry = { client: Sql; ready: Promise<void> };
const clients = new Map<string, Entry>();
function sandboxClient(id: string, parsers: object, serializers: object) {
  const existing = clients.get(id);
  if (existing) {
    clients.delete(id);
    clients.set(id, existing);
    return existing;
  }
  const schema = sandboxSchema(id);
  const client = postgres(env.DATABASE_URL_DIRECT ?? env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    max_lifetime: 30 * 60,
    connection: { options: `-c search_path=${schema}` },
    onnotice: () => {},
  });
  // Drizzle installs its date parsers on the client it wraps (the router).
  Object.assign(client.options.parsers, parsers);
  Object.assign(client.options.serializers, serializers);
  const ready = client`select array_to_string(current_schemas(false), ',') as path`.then(([row]) => {
    if (row.path !== schema) throw new Error("Demo sandbox connection is not isolated; refusing to use it.");
  });
  const entry = { client, ready };
  ready.catch(() => {
    if (clients.get(id) === entry) clients.delete(id);
    client.end({ timeout: 5 }).catch(() => {});
  });
  clients.set(id, entry);
  if (clients.size > MAX_CLIENTS) {
    const [oldest, old] = clients.entries().next().value!;
    clients.delete(oldest);
    old.client.end({ timeout: 5 }).catch(() => {});
  }
  return entry;
}

/** Close a dropped sandbox's connection on this instance. */
export async function closeSandboxClient(id: string) {
  liveness.delete(id);
  const entry = clients.get(id);
  clients.delete(id);
  await entry?.client.end({ timeout: 5 });
}
export async function closeSandboxClients() {
  const all = [...clients.values()];
  clients.clear();
  liveness.clear();
  await Promise.all(all.map((entry) => entry.client.end({ timeout: 5 })));
}

export function createRoutingClient(shared: Sql): Sql {
  const options = { parsers: {}, serializers: {} };
  const pick = async () => {
    const id = await currentSandboxId();
    if (!id || !(await isLive(shared, id))) return shared;
    const entry = sandboxClient(id, options.parsers, options.serializers);
    await entry.ready;
    return entry.client;
  };
  const router = {
    options,
    unsafe(query: string, parameters?: unknown[]) {
      const run = async (values: boolean) => {
        const pending = (await pick()).unsafe(query, parameters as never);
        return values ? pending.values() : pending;
      };
      return {
        values: () => run(true),
        then: (resolve?: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => run(false).then(resolve, reject),
      };
    },
    begin: async (...args: unknown[]) => ((await pick()).begin as (...a: unknown[]) => unknown)(...args),
  };
  return router as unknown as Sql;
}
