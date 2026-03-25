import { setTimeout as sleep } from "node:timers/promises";
import { matchSorter } from "match-sorter";
import { getContext } from "remix/async-context-middleware";
import { column as c, table, type TableRow } from "remix/data-table";
import sortBy from "sort-by";
import { Database } from "./middleware.ts";

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
        createdAt: c.timestamp().defaultNow(),
    },
});

export type Contact = TableRow<typeof Contacts>;

export async function getContacts(query?: string): Promise<Contact[]> {
    let db = getContext().get(Database);
    await fakeNetwork(`getContacts:${query}`);

    let contacts = await db.findMany(Contacts);

    if (query) {
        contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
    }

    return contacts.toSorted(sortBy("last", "createdAt"));
}

export async function createContact(): Promise<number> {
    let db = getContext().get(Database);
    let contact = await db.create(
        Contacts,
        {
            first: "",
            last: "",
            bsky: "",
            notes: "",
        },
        { returnRow: true },
    );

    return contact.id;
}

export async function getContact(id?: number): Promise<Contact | null> {
    let db = getContext().get(Database);
    if (!id) return null;
    await fakeNetwork(`contact:${id}`);
    return await db.find(Contacts, id);
}

const AT_PATTERN = /^@+/;

export async function updateContact(id: number, updates: Partial<Contact>) {
    let db = getContext().get(Database);
    await fakeNetwork();

    let contact = await db.find(Contacts, id);
    if (!contact) throw new Error(`Contact with id ${id} not found`);

    // Never allow id/createdAt to be updated via patch
    let { id: _id, createdAt: _createdAt, ...patch } = updates;
    if (Object.keys(patch).length === 0) return contact;

    // Trim any leading @'s off of bsky handle
    if (typeof patch.bsky === "string") {
        patch.bsky = patch.bsky.replace(AT_PATTERN, "");
    }

    return await db.update(Contacts, id, patch);
}

export async function deleteContact(id: number): Promise<boolean> {
    let db = getContext().get(Database);

    try {
        await db.delete(Contacts, id);
        return true;
    } catch {
        return false;
    }
}

// fake a cache so we don't slow down stuff we've already seen
const CACHE = new Map<string, boolean>();

export async function fakeNetwork(key?: string) {
    if (process.env.NODE_ENV === "test") {
        return;
    }

    if (!key || !CACHE.get(key)) {
        if (key) CACHE.set(key, true);
        // Fake network slowdown between 1-3 seconds
        return await sleep(1000 + Math.random() * 2_000);
    }
}
