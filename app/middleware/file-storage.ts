import { R2FileStorage } from "#/data/adapters/r2-file-storage.ts";
import { env } from "cloudflare:workers";
import { type Middleware } from "remix/fetch-router";

export function loadFileStorage(): Middleware {
    let storage = new R2FileStorage(env.FILES);

    return (ctx, next) => {
        ctx.set(R2FileStorage, storage);
        return next();
    };
}
