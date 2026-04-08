import { D1DatabaseAdapter } from "#/lib/adapters/d1-data-table.ts";
import { R2FileStorage } from "#/lib/adapters/r2-file-storage.ts";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/fetch-router";

export function loadDatabase(): Middleware {
    let adapter = new D1DatabaseAdapter(env.DB);
    let db = new Database(adapter);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}

export function loadFileStorage(): Middleware {
    let storage = new R2FileStorage(env.FILES);

    return (ctx, next) => {
        ctx.set(R2FileStorage, storage);
        return next();
    };
}
