import { Database } from "remix/data-table";
import { type Middleware } from "remix/fetch-router";

import { getEnv } from "../env.ts";
import { createD1DatabaseAdapter as d1Adapter } from "./adapter.ts";

/**
 * Database middleware that uses a Cloudflare D1 binding.
 * Lazily initializes the adapter, runs migrations, and seeds on first request.
 */
export function loadDatabase(): Middleware {
    return async (context, next) => {
        let env = getEnv();
        context.set(Database, new Database(d1Adapter(env.DB)));
        return next();
    };
}
