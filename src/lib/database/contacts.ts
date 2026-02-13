import { DatabaseSync } from "node:sqlite";
import { setTimeout } from "node:timers/promises";
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { createStore } from "./db.ts";
import { seed } from "./seed.ts";

export interface Contact {
    id: string; // SQLite integer id serialized as string
    first: string;
    last: string;
    avatar: string;
    bsky: string;
    notes: string;
    favorite?: boolean;
    createdAt: Date;
}

const db = new DatabaseSync(":memory:");
const store = createStore(db);

await seed(db);

export async function getContacts(query: string | null) {
    await fakeNetwork(`getContacts:${query}`);

    let contacts = store.all();

    if (query) {
        contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
    }

    return contacts.toSorted(sortBy("last", "createdAt"));
}

export function createContact() {
    return store.insert();
}

export async function getContact(id?: string) {
    if (!id) return null;
    await fakeNetwork(`contact:${id}`);
    return store.get(id);
}

const AT = /^@+/;

export async function updateContact(id: string, updates: Partial<Contact>) {
    await fakeNetwork();

    const contact = store.get(id);
    if (!contact) throw new Error(`Contact with id ${id} not found`);

    // Trim any leading @'s off of bsky handle
    if (typeof updates.bsky === "string") {
        updates.bsky = updates.bsky.replace(AT, "");
    }

    const updated = store.update(id, updates);
    if (!updated) throw new Error(`Contact with id ${id} not found`);

    return updated;
}

export function deleteContact(id: string): true {
    store.delete(id);
    return true;
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
