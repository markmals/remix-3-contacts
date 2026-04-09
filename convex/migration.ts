import { internalMutation } from "./_generated/server";

const SEED_CONTACTS = [
    {
        first: "Brooks",
        last: "Lybrand",
        bsky: "brookslybrand.bsky.social",
        favorite: false,
    },
    {
        first: "Mark",
        last: "Dalgleish",
        bsky: "markdalgleish.com",
        favorite: false,
    },
    {
        first: "Pedro",
        last: "Cattori",
        bsky: "pedrocattori.com",
        favorite: false,
    },
    {
        first: "Kent C.",
        last: "Dodds",
        bsky: "kentcdodds.com",
        favorite: false,
    },
    {
        first: "Jacob",
        last: "Ebey",
        bsky: "ebey.bsky.social",
        favorite: false,
    },
];

export let seed = internalMutation({
    args: {},
    handler: async ctx => {
        let existing = await ctx.db.query("contacts").take(1);
        if (existing.length > 0) {
            return;
        }
        for (let contact of SEED_CONTACTS) {
            await ctx.db.insert("contacts", contact);
        }
    },
});

export let clear = internalMutation({
    args: {},
    handler: async ctx => {
        let contacts = await ctx.db.query("contacts").collect();

        for (let contact of contacts) {
            await ctx.db.delete("contacts", contact._id);
        }
    },
});
