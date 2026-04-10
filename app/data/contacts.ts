import type { Doc } from "#convex/_generated/dataModel.js";

import { convex } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";

// The base doc type from Convex
type ContactDoc = Doc<"contacts">;

// Queries return contacts with resolved avatar URLs
export type Contact = Omit<ContactDoc, "avatar"> & {
    avatarUrl: string | null;
    avatar?: ContactDoc["avatar"];
};

export async function getContacts(query?: string): Promise<Contact[]> {
    return await convex.http.query(api.contacts.list, { query: query || undefined });
}

export async function getContact(id?: string): Promise<Contact | null> {
    if (!id) return null;
    return await convex.http.query(api.contacts.get, { id: id as any });
}
