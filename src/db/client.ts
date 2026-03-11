/**
 * INDEX — Neon PostgreSQL client (singleton)
 *
 * Uses @neondatabase/serverless for both serverless (edge) and Node.js environments.
 * The DATABASE_URL env var must be set (see .env.example).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. " +
      "Copy .env.example to .env and fill in your Neon connection string."
  );
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
