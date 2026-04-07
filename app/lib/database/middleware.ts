import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/fetch-router";

import { createD1DatabaseAdapter as d1Adapter } from "./adapter.ts";

/**
 * Database middleware that uses a Cloudflare D1 binding.
 * Lazily initializes the adapter, runs migrations, and seeds on first request.
 */
export function loadDatabase(): Middleware {
    let db = new Database(d1Adapter(env.DB));

    return async (context, next) => {
        context.set(Database, db);
        return next();
    };
}
