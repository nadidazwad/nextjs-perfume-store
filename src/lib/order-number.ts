import { sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { storeConfig } from "../../store.config";

/** Unique, increasing numbers. PostgreSQL sequences can leave gaps after rollbacks. */
export async function nextOrderNumber(executor: DbExecutor = db): Promise<string> {
  const [row] = await executor.select({ number: sql<string>`nextval('order_number_seq')::text` }).from(sql`(SELECT 1) AS request`);
  return `${storeConfig.store.orderNumberPrefix}-${row.number}`;
}
