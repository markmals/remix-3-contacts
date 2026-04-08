import path from "node:path";
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";
import { getPlatformProxy } from "wrangler";

import { createD1DatabaseAdapter } from "../lib/database/adapter.ts";

let directionArg = process.argv[2] ?? "up";
let direction = directionArg === "down" ? "down" : "up";
let to = process.argv[3];

let proxy = await getPlatformProxy<Env>({
    configPath: "./wrangler.jsonc",
    persist: true,
});

let adapter = createD1DatabaseAdapter(proxy.env.DB);
let migrations = await loadMigrations(path.resolve("app/db/migrations"));
let runner = createMigrationRunner(adapter, migrations);

try {
    let result = direction === "up" ? await runner.up({ to }) : await runner.down({ to });
    console.log(direction + " complete", {
        applied: result.applied.map(entry => entry.id),
        reverted: result.reverted.map(entry => entry.id),
    });
} finally {
    await proxy.dispose();
    process.exit(0);
}
