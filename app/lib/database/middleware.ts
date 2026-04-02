import SQLite from "better-sqlite3";
import { Database } from "remix/data-table";
import { createSqliteDatabaseAdapter as sqliteAdapter } from "remix/data-table-sqlite";
import {
    createMigration,
    createMigrationRegistry,
    createMigrationRunner,
} from "remix/data-table/migrations";
import { type Middleware } from "remix/fetch-router";

import { Contacts } from "./contacts.ts";
import { seed } from "./seed.ts";

let createContacts = createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts);
        await schema.createIndex(Contacts, ["last", "createdAt"]);
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});

export async function loadDatabase(): Promise<Middleware> {
    let sqlite = new SQLite(":memory:");
    let adapter = sqliteAdapter(sqlite);
    let db = new Database(adapter);

    // Initialize table using migration helpers
    let registry = createMigrationRegistry();
    registry.register({
        id: crypto.randomUUID(),
        name: "create_contacts",
        migration: createContacts,
    });
    let runner = createMigrationRunner(adapter, registry);
    await runner.up();

    await seed(db);

    return async (context, next) => {
        context.set(Database, db);
        return next();
    };
}
