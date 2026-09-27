import { randomBytes } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getTableConfig } from "drizzle-orm/pg-core";
import { publicSql } from "@/db";
import { closeSandboxClient } from "@/db/sandbox-router";
import { sandboxSequences, sandboxTables } from "@/db/schema";
import { sandboxSchema } from "./cookie";

/**
 * Demo sandboxes (DEMO_MODE): a visitor's private copy of the store tables in
 * schema `demo_<id>`, copied from `public` (the pristine demo). Creation,
 * eviction and cleanup take one advisory lock, so the cap holds across
 * serverless instances. Every statement names its schema explicitly.
 */
export const SANDBOX_TTL_MS = 2 * 60 * 60_000;
export const SANDBOX_CAP = 50;
const LOCK = 7_407_000_001;

const tableNames = sandboxTables.map((table) => getTableConfig(table).name);
const sequenceNames = sandboxSequences.map((sequence) => sequence.seqName!);
const quote = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected identifier: ${name}`);
  return `"${name}"`;
};
const integer = (value: unknown) => {
  if (!/^-?\d+$/.test(String(value))) throw new Error("Unexpected sequence value.");
  return String(value);
};

/** 16 characters of base32: 80 random bits. */
export function newSandboxId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  return Array.from(randomBytes(16), (byte) => alphabet[byte & 31]).join("");
}

type ForeignKey = { table: string; name: string; ref: string; def: string };
// Foreign keys change only with a migration, i.e. a new deployment: read them once per process.
let foreignKeys: Promise<ForeignKey[]> | undefined;
const readForeignKeys = (tx: TransactionSql) =>
  tx<ForeignKey[]>`
    select rel.relname as table, con.conname as name, ref.relname as ref, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join pg_class ref on ref.oid = con.confrelid
    where con.contype = 'f' and ns.nspname = 'public' and rel.relname = any(${tableNames})
    order by rel.relname, con.conname`.then((rows) => [...rows]);

/** One multi-statement script: schema, tables (with indexes, checks, defaults), rows, sequences, then foreign keys. */
async function cloneScript(tx: TransactionSql, schema: string) {
  // Catalog output below is then fully schema-qualified.
  await tx`set local search_path = pg_catalog`;
  const keys = await (foreignKeys ??= readForeignKeys(tx).catch((error) => {
    foreignKeys = undefined;
    throw error;
  }));
  const sequences = await tx<{ name: string; type: string; start: string; step: string; min: string; max: string; cycle: boolean; last: string | null }[]>`
    select sequencename as name, data_type::text as type, start_value::text as start, increment_by::text as step,
      min_value::text as min, max_value::text as max, cycle, last_value::text as last
    from pg_sequences where schemaname = 'public' and sequencename = any(${sequenceNames})`;
  if (sequences.length !== sequenceNames.length) throw new Error("A sandbox sequence is missing from public.");

  const target = quote(schema);
  const lines = [`create schema ${target};`];
  for (const table of tableNames) lines.push(`create table ${target}.${quote(table)} (like public.${quote(table)} including all);`);
  for (const table of tableNames) lines.push(`insert into ${target}.${quote(table)} select * from public.${quote(table)};`);
  for (const s of sequences) {
    if (!["smallint", "integer", "bigint"].includes(s.type)) throw new Error("Unexpected sequence type.");
    lines.push(
      `create sequence ${target}.${quote(s.name)} as ${s.type} increment by ${integer(s.step)} minvalue ${integer(s.min)} maxvalue ${integer(s.max)} start with ${integer(s.start)} ${s.cycle ? "cycle" : "no cycle"};`,
    );
    if (s.last !== null) lines.push(`select setval('${schema}.${s.name}', ${integer(s.last)}, true);`);
  }
  for (const key of keys) {
    if (!tableNames.includes(key.ref)) throw new Error(`${key.table}.${key.name} references a table sandboxes don't copy.`);
    const pattern = /REFERENCES public\.("?[a-z_][a-z0-9_]*"?)\(/g;
    if ((key.def.match(pattern) ?? []).length !== 1) throw new Error(`Unexpected foreign key: ${key.name}`);
    lines.push(`alter table ${target}.${quote(key.table)} add constraint ${quote(key.name)} ${key.def.replace(pattern, `REFERENCES ${target}.$1(`)};`);
  }
  return lines.join("\n");
}

/** Drops sandbox schemas, their registry rows and their demo users (with sessions). Caller holds the lock. */
async function dropInside(tx: TransactionSql, ids: string[]) {
  if (!ids.length) return;
  for (const id of ids) await tx.unsafe(`drop schema if exists ${quote(sandboxSchema(id))} cascade`);
  await tx`delete from public."user" where role = 'demo' and id in (select user_id from public.demo_sandboxes where id = any(${ids}))`;
  await tx`delete from public.demo_sandboxes where id = any(${ids})`;
}

type Options = { ttlMs?: number; cap?: number; now?: Date };

/** Creates a sandbox for an existing demo user, first removing expired ones and, at the cap, the oldest. */
export async function createSandbox(userId: string, { ttlMs = SANDBOX_TTL_MS, cap = SANDBOX_CAP, now = new Date() }: Options = {}) {
  const id = newSandboxId();
  const schema = sandboxSchema(id);
  const expiresAt = new Date(now.getTime() + ttlMs);
  const removed = await publicSql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK})`;
    const live = await tx<{ id: string; expired: boolean }[]>`
      select id, expires_at <= ${now.toISOString()}::timestamptz as expired
      from public.demo_sandboxes order by created_at, id`;
    const doomed = live.filter((row) => row.expired).map((row) => row.id);
    const kept = live.filter((row) => !row.expired).map((row) => row.id);
    while (kept.length >= cap) doomed.push(kept.shift()!);
    await dropInside(tx, doomed);
    await tx.unsafe(await cloneScript(tx, schema)).simple();
    await tx`insert into public.demo_sandboxes (id, user_id, expires_at, created_at)
      values (${id}, ${userId}, ${expiresAt.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz)`;
    return doomed;
  });
  await Promise.all(removed.map(closeSandboxClient));
  return { id, schema, expiresAt, removed };
}

export async function dropSandboxes(ids: string[]) {
  await publicSql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK})`;
    await dropInside(tx, ids);
  });
  await Promise.all(ids.map(closeSandboxClient));
}

/** "Reset": a fresh copy of the store for the same visitor, keeping their expiry and place in the queue. */
export async function resetSandbox(id: string, userId: string) {
  const next = newSandboxId();
  const expiresAt = await publicSql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK})`;
    const [row] = await tx<{ expires: string; created: string }[]>`
      select expires_at::text as expires, created_at::text as created from public.demo_sandboxes
      where id = ${id} and user_id = ${userId} and expires_at > now()`;
    if (!row) throw new Error("This demo sandbox has ended.");
    await tx.unsafe(`drop schema if exists ${quote(sandboxSchema(id))} cascade`);
    await tx`delete from public.demo_sandboxes where id = ${id}`;
    await tx.unsafe(await cloneScript(tx, sandboxSchema(next))).simple();
    await tx`insert into public.demo_sandboxes (id, user_id, expires_at, created_at)
      values (${next}, ${userId}, ${row.expires}::timestamptz, ${row.created}::timestamptz)`;
    return new Date(row.expires);
  });
  await closeSandboxClient(id);
  return { id: next, schema: sandboxSchema(next), expiresAt };
}

/**
 * Removes every expired sandbox and its demo user, plus demo users left without
 * a sandbox (a start that failed halfway). Returns the removed sandbox ids.
 */
export async function dropExpiredSandboxes(now = new Date()) {
  const removed = await publicSql().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK})`;
    const rows = await tx<{ id: string }[]>`select id from public.demo_sandboxes where expires_at <= ${now.toISOString()}::timestamptz`;
    await dropInside(tx, rows.map((row) => row.id));
    // Schemas and registry rows are created and dropped in one transaction, so a
    // sandbox schema without a row can only be debris: remove it.
    const orphans = await tx<{ name: string }[]>`
      select nspname as name from pg_namespace
      where nspname ~ '^demo_[a-z0-9]{16}$' and substr(nspname, 6) not in (select id from public.demo_sandboxes)`;
    for (const { name } of orphans) await tx.unsafe(`drop schema ${quote(name)} cascade`);
    await tx`delete from public."user" u where u.role = 'demo'
      and u.created_at < ${now.toISOString()}::timestamptz - interval '10 minutes'
      and not exists (select 1 from public.demo_sandboxes d where d.user_id = u.id)`;
    return rows.map((row) => row.id);
  });
  await Promise.all(removed.map(closeSandboxClient));
  return removed;
}
