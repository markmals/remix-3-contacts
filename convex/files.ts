import { mutation } from "./_generated/server";

export let generateUploadUrl = mutation({
    args: {},
    handler: async ctx => {
        return await ctx.storage.generateUploadUrl();
    },
});
