import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/router";

type DatabaseEntry = { key: typeof Database; value: Database };

export function database(): Middleware<DatabaseEntry> {
    // Built once per isolate: the binding is stable, so there is nothing to
    // rebuild per request.
    let db = createD1Database(env.DB);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
