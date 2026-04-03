import type { DatabaseAdapter } from "remix/data-table";

import {
    createMigration,
    createMigrationRegistry,
    createMigrationRunner,
} from "remix/data-table/migrations";
import { getPlatformProxy } from "wrangler";

import { createD1DatabaseAdapter as d1Adapter } from "../app/lib/database/adapter.ts";
import { Contacts } from "../app/lib/database/contacts.ts";

let migration = createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts, { ifNotExists: true });
        await schema.createIndex(Contacts, ["last", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});

export async function createContactsTable(adapter: DatabaseAdapter) {
    let registry = createMigrationRegistry();
    registry.register({
        id: crypto.randomUUID(),
        name: "create_contacts",
        migration,
    });
    let runner = createMigrationRunner(adapter, registry);
    let result = await runner.up();

    console.log({
        applied: result.applied.map(x => x.id),
        reverted: result.reverted.map(x => x.id),
    });
}

if (import.meta.main) {
    let proxy = await getPlatformProxy<Env>({
        configPath: "./wrangler.jsonc",
        persist: true,
    });

    let adapter = d1Adapter(proxy.env.DB);
    await createContactsTable(adapter);
    await proxy.dispose();
    process.exit(0);
}
