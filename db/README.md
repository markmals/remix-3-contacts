# Database

Migrations are authored in TypeScript, compiled to SQL, and applied
via Wrangler's official D1 migrations workflow. Both `--local` and
`--remote` apply the **same generated `.sql` files** — there is no
separate TypeScript path against the dev database.

Demo data is populated separately by a standalone seed script
(`db/seed.ts`), not via migrations.

## Authoring migrations

Write migrations in TypeScript under `db/migrations/`, using
`remix/data-table/migrations`. Filenames follow
`YYYYMMDDHHmmss_description.ts` and each file default-exports
`createMigration({ up, down })`.

Migrations MUST use only `schema.*` operations (DDL). Anything that
calls `db.*` data operations cannot be dry-run to SQL — put that
logic in `db/seed.ts` instead.

## Local development

`vp dev` triggers `db:seed`, which chains:

1. `db:migrations:generate` — regenerate `db/d1-migrations/*.sql`
   from `db/migrations/*.ts`.
2. `db:migrations:apply:local` — `wrangler d1 migrations apply DB --local`
   against the local D1 in `.wrangler/`.
3. `node db/seed.ts` — populate demo contacts (idempotent: skipped
   when the table already has rows).

You can also run any of these individually:

    vp run db:migrations:generate
    vp run db:migrations:apply:local
    vp run db:seed

To wipe the local D1 entirely (useful when the journal gets out of sync):

    vp run db:reset

## Remote D1 (production)

Production deploys apply the same SQL files via Wrangler's official
D1 migrations workflow:

1. `vp run db:migrations:generate` — runs each TS migration through
   the data-table runner in `dryRun: true` mode and writes one
   deterministic `.sql` file per source migration into
   `db/d1-migrations/`. These files are committed to git.
2. `vp run db:migrations:apply:remote` — shells out to
   `wrangler d1 migrations apply DB --remote`, which reads
   `db/d1-migrations/` and uses Wrangler's own `d1_migrations`
   journal table on the remote database.
3. `vp run db:migrations:deploy` — chains both.

The `--remote` target needs `CLOUDFLARE_API_TOKEN` (or
`CLOUDFLARE_API_KEY`) in the environment.

The seed script does NOT run against remote — production starts
empty.
