# Data-Table Migrations Restructure

Reorganize the local migration and seed scripts to follow the idiomatic Remix `data-table` migrations pattern with filesystem discovery.

## Current State

- `scripts/create-contacts.ts` — ad-hoc migration runner; defines migration inline, uses `createMigrationRegistry` with `crypto.randomUUID()` as the ID, exports `createContactsTable()` helper
- `scripts/seed.ts` — imports `createContactsTable`, wipes contacts, re-inserts 5 seed rows
- Vite tasks: `db:create` and `db:seed` invoke these scripts; `dev` depends on `db:seed`

## Target State

### Directory layout

```
app/db/
  migrations/
    20260408000000_create_contacts.ts
    20260408000001_seed_contacts.ts
  migrate.ts
  reset.ts
```

`scripts/` directory is deleted entirely.

### Migration files

Each file default-exports `createMigration({ up, down })`. IDs and names are inferred from filenames by `loadMigrations()`.

**`20260408000000_create_contacts.ts`**

- `up`: creates the `contacts` table using the `Contacts` table definition from `app/lib/database/contacts.ts`, then creates a composite index on `(last, createdAt)`
- `down`: drops the `contacts` table with `ifExists: true`

**`20260408000001_seed_contacts.ts`**

- `up`: queries the contacts table; if empty, inserts the 5 seed contacts (Brooks Lybrand, Mark Dalgleish, Pedro Cattori, Kent C. Dodds, Jacob Ebey)
- `down`: deletes all rows from the contacts table (seed data only, safe to wipe)

### Runner script (`migrate.ts`)

- Uses `loadMigrations()` from `remix/data-table/migrations/node` to discover `app/db/migrations/`
- Reads `process.argv[2]` for direction (`up` or `down`, defaults to `up`)
- Reads `process.argv[3]` for optional target migration ID
- Connects to D1 via `getPlatformProxy` with `persist: true`
- Logs applied/reverted migration IDs
- Calls `proxy.dispose()` and `process.exit(0)` on completion

### Reset script (`reset.ts`)

- Deletes `.wrangler/state/v3/d1/` using `node:fs` `rmSync` with `recursive: true` and `force: true`
- Logs confirmation message

### Vite task changes in `vite.config.ts`

- Add `"db:migrate"` task: `node app/db/migrate.ts`
- Add `"db:reset"` task: `node app/db/reset.ts`
- Remove `"db:seed"` and `"db:create"` tasks
- Update `"dev"` to depend on `["typegen", "db:migrate"]` instead of `["typegen", "db:seed"]`

### Files to delete

- `scripts/create-contacts.ts`
- `scripts/seed.ts`
- `scripts/` directory itself

### Import updates

No other files in the project import from `scripts/create-contacts.ts` or `scripts/seed.ts` — the only consumer is the Vite task config, which gets updated.
