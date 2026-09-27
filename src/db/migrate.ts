import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, closeDb } from "./index";

async function main() {
  // Both drivers use the same PostgreSQL dialect migration implementation.
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.info("Database migrations applied.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closeDb);
