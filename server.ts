import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./src/router.ts";

const server = http.createServer(
    createRequestListener(async (request: Request) => {
        try {
            return await router.fetch(request);
        } catch (error) {
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
        }
    }),
);

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 1612;

server.listen(port, () => {
    console.log(`Contacts demo is running on http://localhost:${port}`);
});

let shuttingDown = false;

function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
