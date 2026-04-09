import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    contacts: defineTable({
        first: v.string(),
        last: v.string(),
        avatar: v.optional(v.id("_storage")),
        bsky: v.string(),
        notes: v.optional(v.string()),
        favorite: v.boolean(),
    }).index("by_last", ["last"]),
});
