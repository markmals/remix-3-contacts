import { D1DatabaseAdapter } from "#/data/adapters/d1-data-table.ts";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/router";

type DatabaseEntry = { key: typeof Database; value: Database };

export function database(): Middleware<DatabaseEntry> {
    let adapter = new D1DatabaseAdapter(env.DB);
    let db = new Database(adapter);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
