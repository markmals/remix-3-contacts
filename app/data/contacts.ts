import type { Doc } from "#convex/_generated/dataModel.js";

import { api } from "#convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";
import { getContext } from "remix/async-context-middleware";

// The base doc type from Convex
type ContactDoc = Doc<"contacts">;

// Queries return contacts with resolved avatar URLs
export type Contact = Omit<ContactDoc, "avatar"> & {
    avatarUrl: string | null;
    avatar?: ContactDoc["avatar"];
};

export async function getContacts(query?: string): Promise<Contact[]> {
    let client = getContext().get(ConvexHttpClient);
    return await client.query(api.contacts.list, { query: query || undefined });
}

export async function getContact(id?: string): Promise<Contact | null> {
    let client = getContext().get(ConvexHttpClient);
    if (!id) return null;
    return await client.query(api.contacts.get, { id: id as any });
}
