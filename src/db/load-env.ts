import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Next loads env files for the app. Standalone Drizzle/tsx commands need this too.
if (existsSync(".env")) loadEnvFile(".env");
