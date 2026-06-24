/**
 * db/client.ts — the Drizzle/Postgres client. Built from `DATABASE_URL` at the edge
 * (Railway injects it). Kept tiny so the engine never sees a database.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export function makeDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof makeDb>;
