import { setTimeout } from "node:timers/promises";
import Database from "better-sqlite3";
import { matchSorter } from "match-sorter";
import * as s from "remix/data-schema";
import * as c from "remix/data-schema/checks";
import { createDatabase, createTable, type TableRow } from "remix/data-table";
import { createSqliteDatabaseAdapter } from "remix/data-table-sqlite";
import sortBy from "sort-by";
import { seed } from "./seed.ts";

export const Contacts = createTable({
    name: "contacts",
    columns: {
        id: s.number(),
        first: s.string(),
        last: s.string(),
        avatar: s.nullable(s.string().pipe(c.url())),
        bsky: s.string(),
        notes: s.string(),
        favorite: s.boolean(),
        createdAt: s.number(),
    },
});

export type Contact = TableRow<typeof Contacts>;

const sqlite = new Database(":memory:");
const db = createDatabase(createSqliteDatabaseAdapter(sqlite));

await seed(db);

export function initializeContactTable() {
    sqlite.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_contacts_last_createdAt
        ON contacts (last, createdAt);  
    `);
}

export async function getContacts(query: string | null): Promise<Contact[]> {
    await fakeNetwork(`getContacts:${query}`);

    let contacts = await db.findMany(Contacts);

    if (query) {
        contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
    }

    return contacts.toSorted(sortBy("last", "createdAt"));
}

export async function createContact(): Promise<number> {
    const contact = await db.create(
        Contacts,
        {
            first: "",
            last: "",
            avatar: null,
            bsky: "",
            notes: "",
            favorite: false,
            createdAt: Date.now(),
        },
        { returnRow: true },
    );

    return contact.id;
}

export async function getContact(id?: number): Promise<Contact | null> {
    if (!id) return null;
    await fakeNetwork(`contact:${id}`);
    return await db.find(Contacts, id);
}

const AT = /^@+/;

export async function updateContact(id: number, updates: Partial<Contact>) {
    await fakeNetwork();

    let contact = await db.find(Contacts, id);
    if (!contact) throw new Error(`Contact with id ${id} not found`);

    // Never allow id/createdAt to be updated via patch
    const { id: _id, createdAt: _createdAt, ...patch } = updates;
    if (Object.keys(patch).length === 0) return contact;

    // Trim any leading @'s off of bsky handle
    if (typeof updates.bsky === "string") {
        updates.bsky = updates.bsky.replace(AT, "");
    }

    return await db.update(Contacts, id, patch);
}

export async function deleteContact(id: number): Promise<boolean> {
    try {
        await db.delete(Contacts, id);
        return true;
    } catch {
        return false;
    }
}

// fake a cache so we don't slow down stuff we've already seen
const fakeCache = new Map<string, boolean>();

export async function fakeNetwork(key?: string) {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    if (!key || !fakeCache.get(key)) {
        if (key) fakeCache.set(key, true);
        // Fake network slowdown between 1-3 seconds
        return await setTimeout(1000 + Math.random() * 2_000);
    }
}
