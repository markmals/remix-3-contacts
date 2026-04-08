import { createMigration } from "remix/data-table/migrations";

import { Contacts } from "../contacts.ts";

export default createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts, { ifNotExists: true });
        await schema.createIndex(Contacts, ["last", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});
