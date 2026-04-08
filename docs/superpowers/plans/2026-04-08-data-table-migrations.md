# Data-Table Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure ad-hoc migration/seed scripts into idiomatic Remix data-table migrations with filesystem discovery.

**Architecture:** Migration files live in `app/db/migrations/` with timestamp-based filenames. A standalone runner script (`app/db/migrate.ts`) uses `loadMigrations()` for filesystem discovery and `getPlatformProxy` for D1 access. Seeding is a conditional migration that only inserts when the table is empty. A `db:reset` Vite task wipes D1 local state with a shell command.

**Tech Stack:** `remix/data-table`, `remix/data-table/migrations`, `remix/data-table/migrations/node`, Cloudflare D1 via `wrangler` platform proxy

---

### File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `app/db/migrations/20260213161402_create_contacts.ts` | Create contacts table + index |
| Create | `app/db/migrations/20260402234741_seed_contacts.ts` | Conditionally seed 5 contacts |
| Create | `app/db/migrate.ts` | Runner script: load migrations, connect D1, apply up/down |
| Modify | `vite.config.ts` | Update Vite tasks |
| Delete | `scripts/create-contacts.ts` | Replaced by migration 1 |
| Delete | `scripts/seed.ts` | Replaced by migration 2 |

---

### Task 1: Create the `create_contacts` migration

**Files:**
- Create: `app/db/migrations/20260213161402_create_contacts.ts`

- [ ] **Step 1: Create the migration file**

Create `app/db/migrations/20260213161402_create_contacts.ts`:

```ts
import { createMigration } from "remix/data-table/migrations";

import { Contacts } from "../../lib/database/contacts.ts";

export default createMigration({
    async up({ schema }) {
        await schema.createTable(Contacts, { ifNotExists: true });
        await schema.createIndex(Contacts, ["last", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Contacts, { ifExists: true });
    },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/db/migrations/20260213161402_create_contacts.ts
git commit -m "Add create_contacts migration"
```

---

### Task 2: Create the `seed_contacts` migration

**Files:**
- Create: `app/db/migrations/20260402234741_seed_contacts.ts`

- [ ] **Step 1: Create the migration file**

Create `app/db/migrations/20260402234741_seed_contacts.ts`:

```ts
import { Database, sql } from "remix/data-table";
import { createMigration } from "remix/data-table/migrations";

import { Contacts } from "../../lib/database/contacts.ts";

let SEED_CONTACTS = [
    {
        first: "Brooks",
        last: "Lybrand",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:l7sltcx6yitxew2vgcrn72ge/bafkreibg6v7njo3pxsmzxa262j6ikw4i66umygdawz5iduuu3h4tfyprbm@jpeg",
        bsky: "brookslybrand.bsky.social",
    },
    {
        first: "Mark",
        last: "Dalgleish",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:hucjy724rz245jjd3ismnwcy/bafkreifecuk7zywjcxraqr75ua7hp3jtj2g5zygifh3cmzbe3hpsnqr7ye@jpeg",
        bsky: "markdalgleish.com",
    },
    {
        first: "Pedro",
        last: "Cattori",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:6zwkx24n4vucdcfgzbwzfy57/bafkreihecdr73d63xajbsrr525j7mih4dymzc5scaz7fr6qtyuouenrheu@jpeg",
        bsky: "pedrocattori.com",
    },
    {
        first: "Kent C.",
        last: "Dodds",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:xzefkiajzjmmyp6zq6ftczg3/bafkreicjzokch3d33ikmot252ilfmlzfnqv6vbhonzcftdslmql3db5tfm@jpeg",
        bsky: "kentcdodds.com",
    },
    {
        first: "Jacob",
        last: "Ebey",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:twegdcgytckr5cxm57gyruxa/bafkreidx3bmu6wprocniiyrpwnpwljky6rat7bjccxxoc66ncybhzt5qxu@jpeg",
        bsky: "ebey.bsky.social",
    },
];

export default createMigration({
    async up({ db }) {
        let result = await db.exec(sql`select count(*) as count from contacts`);
        let count = (result as { count: number }[])[0]?.count ?? 0;

        if (count > 0) return;

        let database = new Database(db.adapter);
        for (let contact of SEED_CONTACTS) {
            await database.create(Contacts, {
                first: contact.first,
                last: contact.last,
                avatar: contact.avatar,
                bsky: contact.bsky,
                notes: "",
                favorite: false,
                createdAt: `${Date.now()}`,
            });
        }
    },
    async down({ db }) {
        await db.exec(sql`delete from contacts`);
    },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/db/migrations/20260402234741_seed_contacts.ts
git commit -m "Add seed_contacts migration"
```

---

### Task 3: Create the migration runner script

**Files:**
- Create: `app/db/migrate.ts`

- [ ] **Step 1: Create the runner script**

Create `app/db/migrate.ts`:

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add app/db/migrate.ts
git commit -m "Add migration runner script"
```

---

### Task 4: Update Vite tasks and delete old scripts

**Files:**
- Modify: `vite.config.ts:23-31`
- Delete: `scripts/create-contacts.ts`
- Delete: `scripts/seed.ts`

- [ ] **Step 1: Update Vite tasks in `vite.config.ts`**

Replace the `tasks` object inside `run` with:

```ts
        tasks: {
            dev: {
                dependsOn: ["typegen", "db:migrate"],
                command: "vp dev --host",
            },
            "db:migrate": {
                command: "node app/db/migrate.ts",
            },
            "db:reset": {
                command: "rm -rf .wrangler/state/v3/d1",
            },
            typegen: {
                input: ["wrangler.jsonc"],
                command: "wrangler types",
            },
            typecheck: {
                dependsOn: ["typegen"],
                command: "tsgo --noEmit",
                cache: false,
            },
            check: {
                dependsOn: ["typegen"],
                command: "vp check --fix",
                cache: false,
            },
            deploy: {
                command: "wrangler deploy",
                cache: false,
            },
        },
```

- [ ] **Step 2: Delete the old scripts directory**

Remove `scripts/create-contacts.ts`, `scripts/seed.ts`, and the `scripts/` directory.

- [ ] **Step 3: Commit**

Stage all changes (new tasks, removed scripts) and commit:

```
Replace ad-hoc scripts with data-table migrations
```

---

### Task 5: Verify migrations work end-to-end

- [ ] **Step 1: Reset the database**

Run `vp run db:reset`. Expected: `.wrangler/state/v3/d1/` directory is deleted, command exits cleanly.

- [ ] **Step 2: Run migrations up**

Run `vp run db:migrate`. Expected: output shows both migration IDs in `applied` array, contacts table created and seeded.

- [ ] **Step 3: Run migrations up again (idempotent)**

Run `vp run db:migrate`. Expected: output shows empty `applied` array (both migrations already applied).

- [ ] **Step 4: Run migrations down**

Run `node app/db/migrate.ts down`. Expected: output shows both migration IDs in `reverted` array.

- [ ] **Step 5: Commit (if any fixups were needed)**

Only if changes were made during verification.
