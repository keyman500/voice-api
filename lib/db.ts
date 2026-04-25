import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

export type DB = ReturnType<typeof createDb>

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Copy .env.example → .env.local and set your PostgreSQL connection string."
    )
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return drizzle(pool, { schema })
}

// Lazy singleton — initialized on first access, never at module load time.
// This allows Next.js to route-discover without DATABASE_URL being set.
let _db: DB | undefined

export function getDb(): DB {
  if (!_db) _db = createDb()
  return _db
}

/**
 * Proxy wrapper so call sites can use `db.query.user.findMany(...)` etc.
 * as if it were a direct Drizzle instance, while still being lazy.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getDb(), prop)
  },
})
