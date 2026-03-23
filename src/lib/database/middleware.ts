import SQLite from "better-sqlite3";
import { createDatabase, type Database, sql } from "remix/data-table";
import { createSqliteDatabaseAdapter } from "remix/data-table-sqlite";
import { createContextKey, type Middleware } from "remix/fetch-router";
import { seed } from "./seed.ts";

export const DB = createContextKey<Database>();

export async function loadDatabase(): Promise<Middleware> {
    const sqlite = new SQLite(":memory:");
    const db = createDatabase(createSqliteDatabaseAdapter(sqlite));

    await db.exec(sql`
    CREATE TABLE IF NOT EXISTS contacts (
    id        INTEGER PRIMARY KEY,
    first     TEXT NOT NULL,
    last      TEXT NOT NULL,
    avatar    TEXT,
    bsky      TEXT NOT NULL,
    notes     TEXT NOT NULL,
    favorite  INTEGER NOT NULL DEFAULT 0
              CHECK (favorite IN (0, 1)),
    createdAt INTEGER NOT NULL
    );
    `);

    await db.exec(sql`
    CREATE INDEX IF NOT EXISTS idx_contacts_last_createdAt
        ON contacts (last, createdAt);  
    `);

    await seed(db);

    return async (context, next) => {
        context.set(DB, db);
        return next();
    };
}
