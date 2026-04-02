import { Database } from "remix/data-table";
import {
    createMigration,
    createMigrationRegistry,
    createMigrationRunner,
} from "remix/data-table/migrations";
import { type Middleware } from "remix/fetch-router";

import { getEnv } from "../env.ts";
import { createD1DatabaseAdapter as d1Adapter } from "./adapter.ts";
import { Contacts } from "./contacts.ts";
import { seed } from "./seed.ts";

let createContacts = createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts, { ifNotExists: true });
        await schema.createIndex(Contacts, ["last", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});

let db: Database;
let initialized = false;

/**
 * Database middleware that uses a Cloudflare D1 binding.
 * Lazily initializes the adapter, runs migrations, and seeds on first request.
 */
export function loadDatabase(): Middleware {
    return async (context, next) => {
        if (!initialized) {
            let env = getEnv();
            let adapter = d1Adapter(env.DB);
            db = new Database(adapter);

            // Run migrations (idempotent — the runner tracks applied migrations)
            let registry = createMigrationRegistry();
            registry.register({
                id: crypto.randomUUID(),
                name: "create_contacts",
                migration: createContacts,
            });
            let runner = createMigrationRunner(adapter, registry);
            await runner.up();

            // Seed only when the table is empty
            let count = await db.count(Contacts);
            if (count === 0) await seed(db);

            initialized = true;
        }

        context.set(Database, db);
        return next();
    };
}
