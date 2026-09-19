import { applyD1Migrations, env } from "cloudflare:test";

// Each worker test runs against an isolated D1 instance, so the schema has to
// be applied before any test touches it. The migrations arrive as data from
// `readD1Migrations()` in vitest.config.ts.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
