import { serve } from "bun";

import { router } from "./dist/ssr/index.js";

let server = serve({
    port: process.env.PORT || 1612,
    fetch: request => router.fetch(request),
});

console.log(`Contacts demo is running on ${server.url}`);

let shuttingDown = false;

async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    await server.stop();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
