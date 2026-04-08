import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/fetch-router";

import { createD1DatabaseAdapter } from "./adapter.ts";

export function loadDatabase(): Middleware {
    let adapter = createD1DatabaseAdapter(env.DB);
    let db = new Database(adapter);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
