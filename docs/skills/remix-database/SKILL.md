---
name: remix-database
description: >
  Use when defining database tables with table() and column, deriving TableRow types, writing migrations with createMigration, running migrations with loadMigrations and getPlatformProxy, evolving schema with alterTable/addColumn/dropColumn, seeding data, or writing query functions via getContext().
---

# Remix Database

## Table Definitions

Define tables with `column` and `table`, derive TypeScript types with `TableRow`:

```tsx
import { column as c, table, type TableRow } from "remix/data-table";

export let Posts = table({
  name: "posts",
  columns: {
    id: c.integer().primaryKey(),
    title: c.text().notNull(),
    body: c.text().notNull(),
    published: c.boolean().default(false),
    createdAt: c.timestamp().defaultNow(),
  },
});

export type Post = TableRow<typeof Posts>;
```

`c.timestamp().defaultNow()` auto-populates on insert -- no need to pass it when creating records.

## Migrations

Each migration is a file in `db/migrations/` that default-exports a `createMigration(...)`. Migrations derive table structure from the `table()` definition.

### File Naming

```
db/migrations/
  20260228090000_create_posts.ts
  20260315140000_add_published_at.ts
  20260320100000_add_tags.ts
```

Name files as `YYYYMMDDHHmmss_name.ts`. The `id` and `name` are inferred from the filename.

### Creating a Table

```tsx
import { Posts } from "#/data/posts.ts";
import { createMigration } from "remix/data-table/migrations";

export default createMigration({
  async up({ schema }) {
    await schema.createTable(Posts, { ifNotExists: true });
    await schema.createIndex(Posts, ["title", "createdAt"], { ifNotExists: true });
  },
  async down({ schema }) {
    await schema.dropTable(Posts, { ifExists: true });
  },
});
```

`schema.createTable()` reads column definitions directly from the `table()` call -- no raw SQL needed.

### Adding a Column

```tsx
import { column as c } from "remix/data-table";
import { createMigration } from "remix/data-table/migrations";
import { Posts } from "../tables.ts";

export default createMigration({
  async up({ schema }) {
    await schema.alterTable(Posts, table => {
      table.addColumn("publishedAt", c.timestamp({ withTimezone: true }));
    });
  },
  async down({ schema }) {
    await schema.alterTable(Posts, table => {
      table.dropColumn("publishedAt");
    });
  },
});
```

### Other `alterTable` Operations

```tsx
await schema.alterTable(Posts, table => {
  table.addColumn("subtitle", c.text());
  table.dropColumn("subtitle");
  table.addPrimaryKey("id");
  table.addForeignKey("author_id", "authors", "id");
  table.addForeignKey(["tenant_id", "author_id"], "authors", ["tenant_id", "id"]);
});
```

### Data Migrations

Combine schema changes with data backfills:

```tsx
import { sql } from "remix/data-table";

export default createMigration({
  async up({ db, schema }) {
    await schema.alterTable(Posts, table => {
      table.addColumn("status", c.text().notNull().default("draft"));
    });
    await db.exec(sql`update posts set status = 'published' where published = true`);
  },
  async down({ schema }) {
    await schema.alterTable(Posts, table => {
      table.dropColumn("status");
    });
  },
});
```

### Defensive Checks

```tsx
async up({ schema }) {
  if (await schema.hasColumn(Posts, "legacy_field")) {
    await schema.alterTable(Posts, table => {
      table.dropColumn("legacy_field");
    });
  }
}
```

### Seed Data

Guard with a count check to avoid duplicating on re-runs:

```tsx
export default createMigration({
  async up({ db }) {
    let count = await db.count(Posts);
    if (count > 0) return;

    for (let post of SEED_POSTS) {
      await db.create(Posts, post);
    }
  },
  async down({ db }) {
    await db.deleteMany(Posts, { where: {} });
  },
});
```

## Migration Runner Script

`db/migrate.ts` -- uses `getPlatformProxy` from `wrangler` for local Cloudflare bindings:

```tsx
import { D1DatabaseAdapter } from "#/data/adapters/d1-data-table.ts";
import path from "node:path";
import * as s from "remix/data-schema";
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";
import { getPlatformProxy } from "wrangler";

let Direction = s.union([s.literal("up" as const), s.literal("down" as const)]);
let direction = s.parse(s.defaulted(Direction, "up"), process.argv[2]);
let to = process.argv[3];

let proxy = await getPlatformProxy<Env>({
  configPath: "./wrangler.jsonc",
  persist: true,
});

let adapter = new D1DatabaseAdapter(proxy.env.DB);
let migrations = await loadMigrations(path.resolve("db/migrations"));
let runner = createMigrationRunner(adapter, migrations);

try {
  let result = await runner[direction]({ to });
  console.log(direction + " complete", {
    applied: result.applied.map(entry => entry.id),
    reverted: result.reverted.map(entry => entry.id),
  });
} finally {
  await proxy.dispose();
}
```

### Runner Commands

```sh
node ./db/migrate.ts up
node ./db/migrate.ts up 20260315140000   # migrate to specific version
node ./db/migrate.ts down                # revert all
node ./db/migrate.ts down 20260228090000 # revert to specific version
```

### Runner Options

| Option         | Purpose                                       |
| -------------- | --------------------------------------------- |
| `to`           | Migrate up/down to a specific migration ID    |
| `step`         | Apply or revert a fixed number of migrations  |
| `dryRun`       | Compile and inspect SQL without applying      |
| `journalTable` | Custom name for the migrations tracking table |

## Query Functions

Access the database through context (see remix-server-entry skill for context setup):

```tsx
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";

export async function getPosts(): Promise<Post[]> {
  let db = getContext().get(Database);
  return await db.findMany(Posts);
}
```

Data access functions use `getContext()` rather than accepting the database as a parameter. This keeps signatures clean and works anywhere in the call stack as long as `asyncContext()` middleware is active.

## Key Principles

- **One migration per change** -- each does one logical thing. Keeps rollbacks predictable.
- **Migrations are append-only** -- never edit a migration already applied in production. Write a new one.
- **Table definition and migration in the same commit** -- the `table()` definition describes current state; the migration describes the transition.
- **Use `dryRun` in CI** -- review generated SQL before deploying.
- **At deploy time**, run migrations before starting the app.
