import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      console.warn("Missing DATABASE_URL environment variable.");
      return null;
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}
