import { v } from "convex/values";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";

import { mutation, query } from "./_generated/server";

let ASPERAND_PATTERN = /^@+/;

export let list = query({
    args: { query: v.optional(v.string()) },
    handler: async (ctx, args) => {
        let contacts = await ctx.db.query("contacts").withIndex("by_last").collect();

        if (args.query) {
            contacts = matchSorter(contacts, args.query, {
                keys: ["first", "last"],
            });
        }

        let sorted = sortBy(contacts, [c => c.last, c => c._creationTime]);

        return Promise.all(
            sorted.map(async contact => {
                let avatarUrl = contact.avatar ? await ctx.storage.getUrl(contact.avatar) : null;
                return { ...contact, avatarUrl };
            }),
        );
    },
});

export let get = query({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        let contact = await ctx.db.get(args.id);
        if (!contact) return null;
        let avatarUrl = contact.avatar ? await ctx.storage.getUrl(contact.avatar) : null;
        return { ...contact, avatarUrl };
    },
});

export let create = mutation({
    args: {
        first: v.string(),
        last: v.string(),
        avatar: v.optional(v.id("_storage")),
        bsky: v.string(),
        notes: v.optional(v.string()),
        favorite: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        let bsky = args.bsky.replace(ASPERAND_PATTERN, "");
        let favorite = args.favorite ?? false;
        return await ctx.db.insert("contacts", { ...args, favorite, bsky });
    },
});

export let update = mutation({
    args: {
        id: v.id("contacts"),
        first: v.optional(v.string()),
        last: v.optional(v.string()),
        avatar: v.optional(v.id("_storage")),
        bsky: v.optional(v.string()),
        notes: v.optional(v.string()),
        favorite: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        let { id, ...updates } = args;
        if (updates.bsky) {
            updates.bsky = updates.bsky.replace(ASPERAND_PATTERN, "");
        }
        await ctx.db.patch(id, updates);
    },
});

export let remove = mutation({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

export let toggleFavorite = mutation({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        let contact = await ctx.db.get(args.id);
        if (!contact) {
            throw new Error("Contact not found");
        }
        await ctx.db.patch(args.id, { favorite: !contact.favorite });
    },
});
