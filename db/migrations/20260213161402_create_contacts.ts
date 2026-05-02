import { column as c, ColumnBuilder, table } from "remix/data-table";
import { createMigration } from "remix/data-table/migrations";

export let Contacts = table({
    name: "contacts",
    columns: {
        id: c.integer().primaryKey(),
        first: c.text().notNull(),
        last: c.text().notNull(),
        avatar: c.text(),
        bsky: c.text().notNull(),
        notes: c.text().notNull(),
        favorite: c.boolean().default(false),
        createdAt: c.timestamp().defaultNow() as ColumnBuilder<string>,
    },
});

export default createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts, { ifNotExists: true });
        await schema.createIndex(Contacts, ["last", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});
