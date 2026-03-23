import { setTimeout as sleep } from "node:timers/promises";
import { matchSorter } from "match-sorter";
import { getContext } from "remix/async-context-middleware";
import { column as c, table, type TableRow } from "remix/data-table";
import sortBy from "sort-by";
import { DB } from "./middleware.ts";

export const Contacts = table({
    name: "contacts",
    columns: {
        id: c.integer(),
        first: c.text(),
        last: c.text(),
        avatar: c.text(),
        bsky: c.text(),
        notes: c.text(),
        favorite: c.boolean(),
        createdAt: c.integer(),
    },
});

export type Contact = TableRow<typeof Contacts>;

export async function getContacts(query: string | null): Promise<Contact[]> {
    const db = getContext().get(DB);
    await fakeNetwork(`getContacts:${query}`);

    let contacts = await db.findMany(Contacts);

    if (query) {
        contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
    }

    return contacts.toSorted(sortBy("last", "createdAt"));
}

export async function createContact(): Promise<number> {
    const db = getContext().get(DB);
    const contact = await db.create(
        Contacts,
        {
            first: "",
            last: "",
            avatar: undefined,
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
    const db = getContext().get(DB);
    if (!id) return null;
    await fakeNetwork(`contact:${id}`);
    return await db.find(Contacts, id);
}

const AT = /^@+/;

export async function updateContact(id: number, updates: Partial<Contact>) {
    const db = getContext().get(DB);
    await fakeNetwork();

    let contact = await db.find(Contacts, id);
    if (!contact) throw new Error(`Contact with id ${id} not found`);

    // Never allow id/createdAt to be updated via patch
    const { id: _id, createdAt: _createdAt, ...patch } = updates;
    if (Object.keys(patch).length === 0) return contact;

    // Trim any leading @'s off of bsky handle
    if (typeof patch.bsky === "string") {
        patch.bsky = patch.bsky.replace(AT, "");
    }

    return await db.update(Contacts, id, patch);
}

export async function deleteContact(id: number): Promise<boolean> {
    const db = getContext().get(DB);

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
        return await sleep(1000 + Math.random() * 2_000);
    }
}
