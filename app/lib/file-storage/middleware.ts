import { env } from "cloudflare:workers";
import { type Middleware } from "remix/fetch-router";

import { R2FileStorage } from "./r2-file-storage.ts";

export function loadFileStorage(): Middleware {
    let storage = new R2FileStorage(env.FILES);

    return (ctx, next) => {
        ctx.set(R2FileStorage, storage);
        return next();
    };
}
