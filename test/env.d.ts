import type { D1Migration } from "@cloudflare/vitest-plugin";

declare global {
    namespace Cloudflare {
        interface Env {
            // The schema is handed to the test worker as data by
            // vitest.config.ts, because `applyD1Migrations` cannot read the
            // filesystem from workerd.
            TEST_MIGRATIONS: D1Migration[];
        }
    }
}
