import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

import { router } from "./app/router.tsx";

const server = http.createServer(
    createRequestListener(request => router.fetch(request), {
        onError(error) {
            // Client disconnects mid-stream cause AbortErrors — not actionable
            if (error instanceof DOMException && error.name === "AbortError") {
                return new Response(null, { status: 499 });
            }
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
        },
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
