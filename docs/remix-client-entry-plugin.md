# Remix Client Entry Vite Plugin — Implementation Guide

This document describes a Vite plugin that transforms `clientEntry(import.meta.url, fn)` calls so that `import.meta.url` is replaced with the resolved production asset URL at build time. It is designed for Remix 3's hydration model where only explicitly marked components ship JavaScript to the client.

Hand this file to your coding agent when you're ready to implement.

## Context

### What the plugin does

Remix 3 uses a `clientEntry` function to mark components for client-side hydration. Authors write:

```tsx
import { clientEntry } from "remix/component";

export const Counter = clientEntry(import.meta.url, function Counter(handle) {
    // component logic
});
```

At build time, `import.meta.url` is meaningless — it's just the source file path. The plugin replaces it with the resolved production asset entry URL plus a `#ExportName` fragment, so at runtime the value becomes something like `/assets/counter-abc123.js#Counter`.

On the server, `clientEntry` uses that string to emit hydration markers and a data script into the HTML. On the client, the `run()` boot function parses the string, calls `loadModule(moduleUrl, exportName)` to dynamically import the chunk, and hydrates the component against the existing DOM.

### Toolchain

This project should be using **Vite+** (Vite 8 with Rolldown as the default bundler) before writing this plugin. Key implications:

- Import `defineConfig` and types from `vite-plus`, not `vite`.
- Rolldown provides `meta.ast` (oxc-parsed AST) and `meta.magicString` (native Rust MagicString) in the `transform` hook — use these instead of `this.parse()` or the `magic-string` npm package.
- The transform hook supports a declarative `filter` object for fast native-level filtering before entering JS.
- AST types come from `oxc-parser` (the `Program` type). Nodes have `start`/`end` as first-class numeric properties.
- Dev server and build commands are `vp dev` and `vp build`.
- Check, lint, format, and test are `vp check`, `vp lint`, `vp fmt`, and `vp test`.

### Dependencies

The plugin depends on `@hiogawa/vite-plugin-fullstack`, which provides:

- **`?assets=<envName>` import query**: importing a module with `?assets=client` (or `?assets=ssr`, etc.) returns an object with `{ entry: string, css: Array<{href}>, js: Array<{href}> }` — the resolved production asset URLs for that module in the given environment.
- **Server handler wiring**: optional — configurable via `serverHandler` option.
- **`mergeAssets` runtime utility**: exported from `@hiogawa/vite-plugin-fullstack/runtime`.

The plugin also uses `oxc-parser` as a dev dependency for the `Program` type.

## Plugin Architecture

The plugin is a Vite plugin array containing two entries:

1. The `fullstack` plugin (from `@hiogawa/vite-plugin-fullstack`) — handles multi-environment builds and the `?assets` query.
2. The `remix-client-entry-transform` plugin — the actual code transform described here.

### Transform Logic

The transform runs in **all environments** (both client and server). Both need the resolved asset URL:

- **Server**: `clientEntry` uses the URL string to write hydration markers into the rendered HTML.
- **Client**: `clientEntry` uses the URL string to identify which chunk to load when the `run()` boot function hydrates the component.

The transform does exactly two things per file:

1. **Prepends** an import statement that resolves the current file's assets for the current environment.
2. **Overwrites** each `import.meta.url` argument inside a `clientEntry(...)` call with the resolved asset entry URL plus a `#ExportName` fragment.

### Multiple `clientEntry` calls per file

Multiple exports in the same file share one asset import. The prepend happens once per file. Each `clientEntry` call gets its own `#ExportName` suffix derived from the variable name of the export.

Given:

```tsx
export const Counter = clientEntry(import.meta.url, function Counter() { ... });
export const Toggle = clientEntry(import.meta.url, function Toggle() { ... });
```

The transform produces:

```tsx
import ___clientEntryAssets from "<id>?assets=<envName>";
export const Counter = clientEntry(___clientEntryAssets.entry + "#Counter", function Counter() { ... });
export const Toggle = clientEntry(___clientEntryAssets.entry + "#Toggle", function Toggle() { ... });
```

## Implementation

### Complete Plugin Source

Create this as `remix.plugin.ts` in the plugin package:

```ts
import fullstack from "@hiogawa/vite-plugin-fullstack";
import type { Program } from "oxc-parser";
import type { PluginOption } from "vite-plus";

export function remix({
    serverEnvironments: _environments = ["ssr"],
    serverHandler = true,
}: {
    serverEnvironments?: string[];
    serverHandler?: boolean;
} = {}): PluginOption {
    return [
        fullstack({
            serverEnvironments: _environments,
            serverHandler,
        }),
        {
            name: "remix-client-entry-transform",
            transform: {
                filter: {
                    code: {
                        include: /\bclientEntry\b/,
                    },
                },
                handler(code, id, meta) {
                    if (!code.includes("import.meta.url")) return;

                    const calls = findClientEntryCalls(meta.ast);
                    if (calls.length === 0) return;

                    const { magicString } = meta;
                    const envName = this.environment.name;

                    magicString.prepend(
                        `import ___clientEntryAssets from "${id}?assets=${envName}";\n`,
                    );

                    for (const call of calls) {
                        magicString.overwrite(
                            call.metaUrlStart,
                            call.metaUrlEnd,
                            `___clientEntryAssets.entry + "#${call.exportName}"`,
                        );
                    }

                    return { code: magicString };
                },
            },
        },
    ];
}

interface ClientEntryCall {
    exportName: string;
    metaUrlStart: number;
    metaUrlEnd: number;
}

function findClientEntryCalls(program: Program): ClientEntryCall[] {
    const results: ClientEntryCall[] = [];

    for (const node of program.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        if (node.declaration?.type !== "VariableDeclaration") continue;

        for (const declarator of node.declaration.declarations) {
            if (declarator.id.type !== "Identifier") continue;
            if (declarator.init?.type !== "CallExpression") continue;

            const call = declarator.init;

            if (call.callee.type !== "Identifier" || call.callee.name !== "clientEntry") continue;

            if (call.arguments.length < 2) continue;

            const firstArg = call.arguments[0];
            if (
                firstArg.type !== "MemberExpression" ||
                firstArg.object.type !== "MetaProperty" ||
                firstArg.property.type !== "Identifier" ||
                firstArg.property.name !== "url"
            )
                continue;

            results.push({
                exportName: declarator.id.name,
                metaUrlStart: firstArg.start,
                metaUrlEnd: firstArg.end,
            });
        }
    }

    return results;
}
```

### AST Pattern Being Matched

The `findClientEntryCalls` function walks the top-level body of the module looking for this exact pattern:

```
ExportNamedDeclaration
  └── VariableDeclaration
       └── VariableDeclarator
            ├── id: Identifier (the export name, e.g. "Counter")
            └── init: CallExpression
                 ├── callee: Identifier { name: "clientEntry" }
                 └── arguments[0]: MemberExpression
                      ├── object: MetaProperty (import.meta)
                      └── property: Identifier { name: "url" }
```

It does **not** match:

- Default exports (`export default clientEntry(...)`) — only named exports.
- Re-exported or aliased `clientEntry` — only the literal identifier name `clientEntry`.
- `import.meta.url` used outside of a `clientEntry` call.
- Non-exported `clientEntry` calls (e.g. `const x = clientEntry(...)` without `export`).

These constraints are intentional. `clientEntry` components must be named exports so the `#ExportName` fragment is meaningful, and the pattern is explicit enough that false positives are essentially impossible.

### Rolldown / Vite 8 specifics

Key API usage:

- **`meta.ast`**: The oxc-parsed AST. Available on every `transform` call. No need to call `this.parse()`.
- **`meta.magicString`**: The native Rust MagicString instance. Supports `.prepend()`, `.append()`, `.overwrite()`, `.appendLeft()`, `.remove()`, etc. Return `{ code: magicString }` — Rolldown generates the sourcemap natively in a background thread.
- **`transform.filter`**: Declarative filter evaluated in Rust before the JS handler runs. The `code.include` regex skips files that don't contain `clientEntry` without entering JS at all.
- **`this.environment.name`**: The current build environment name (e.g. `"client"`, `"ssr"`). Used to parameterize the `?assets=` query.

### Dependencies

```json
{
    "dependencies": {
        "@hiogawa/vite-plugin-fullstack": "0.0.2"
    },
    "devDependencies": {
        "oxc-parser": "^0.72.0"
    }
}
```

`magic-string` is **not** needed — the native implementation is provided by Rolldown.

## Usage in an App

### `vite.config.ts`

```ts
import { remix } from "./remix.plugin.ts";
import { defineConfig } from "vite-plus";

export default defineConfig({
    environments: {
        client: {
            build: {
                rollupOptions: {
                    input: "src/entry.browser",
                },
            },
        },
    },
    plugins: [remix()],
});
```

With options:

```ts
remix({
    serverEnvironments: ["ssr"], // default, which environments are "server"
    serverHandler: true, // default, wire up server handler
});
```

### Component authoring

```tsx
// src/components/counter.tsx
import { clientEntry, on, type Handle } from "remix/component";
import confetti from "canvas-confetti";

export const Counter = clientEntry(import.meta.url, function Counter(handle: Handle) {
    let count = 0;

    return () => (
        <button
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                    confetti();
                }),
            ]}
        >
            Count: <span>{count}</span>
        </button>
    );
});
```

Multiple client entries in one file:

```tsx
// src/components/widgets.tsx
import { clientEntry, on, type Handle } from "remix/component";

export const Counter = clientEntry(import.meta.url, function Counter(handle: Handle) {
    let count = 0;
    return () => (
        <button
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Count: <span>{count}</span>
        </button>
    );
});

export const Toggle = clientEntry(import.meta.url, function Toggle(handle: Handle) {
    let open = false;
    return (props: { label: string }) => (
        <div>
            <button
                mix={[
                    on("click", () => {
                        open = !open;
                        handle.update();
                    }),
                ]}
            >
                {props.label}
            </button>
            {open && <div>Content</div>}
        </div>
    );
});
```

### Client entry point

```ts
// src/entry.browser.ts
import { run } from "remix/component";

run({
    async loadModule(moduleUrl, exportName) {
        const mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    async resolveFrame(src, signal) {
        const res = await fetch(src, { headers: { accept: "text/html" }, signal });
        return res.body ?? (await res.text());
    },
});
```

### Document component (server)

```tsx
// src/components/document.tsx
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";

import clientAssets from "../entry.browser.ts?assets=client";
import serverAssets from "../entry.server.tsx?assets=ssr";

export function Document({ children }) {
    const assets = mergeAssets(clientAssets, serverAssets);

    return (
        <html lang="en">
            <head>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                {assets.js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
                <script async type="module" src={clientAssets.entry} />
            </head>
            <body>{children}</body>
        </html>
    );
}
```

## How Hydration Works End-to-End

1. **Build time**: The plugin replaces `import.meta.url` with the resolved asset URL (e.g. `/assets/counter-a1b2c3.js#Counter`).
2. **Server render**: `clientEntry` renders the component to HTML, wrapping output in `<!-- rmx:h:id -->` / `<!-- /rmx:h -->` comment markers. Props are serialized into a `<script type="application/json" id="rmx-data">` tag.
3. **Client boot**: `run()` parses the data script, finds the markers, splits each entry's URL on `#` to get `moduleUrl` and `exportName`, and calls `loadModule`.
4. **Hydration**: The loaded component function is called against the existing DOM. Matching elements are adopted in place.

## Deployment

The plugin works across different deployment targets. The key difference between targets is how the server environment is configured and how the production server serves assets and handles requests. The client build and component authoring stay the same regardless of target.

### Node

A Node deployment uses the plugin's built-in server handler wiring and a standalone server (e.g. `remix/fetch-server`) to serve the production build.

#### `vite.config.ts`

The Node config must define both `client` and `ssr` environments with explicit output directories, and use the `builder.buildApp` hook to control build order — the SSR environment builds first so that its asset manifest is available when the client build runs:

```ts
import { remix } from "./remix.plugin.ts";
import { defineConfig } from "vite-plus";

export default defineConfig({
    builder: {
        async buildApp(builder) {
            await builder.build(builder.environments.ssr);
            await builder.build(builder.environments.client);
        },
    },
    environments: {
        client: {
            build: {
                outDir: "dist/client",
                rollupOptions: {
                    input: "src/entry.browser",
                },
            },
        },
        ssr: {
            build: {
                outDir: "dist/ssr",
                rollupOptions: {
                    input: "src/entry.server",
                },
            },
        },
    },
    plugins: [remix()],
});
```

The `remix()` plugin is called with default options here — `serverHandler: true` wires up the dev server handler automatically, and `serverEnvironments: ["ssr"]` is the default.

#### Production server

The production server imports the built SSR entry delegates everything else to the app's `fetch` handler. Here's an vanilla Node example:

```ts
// server.ts
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - no types for the built output
import router from "./dist/ssr/entry.server.js";

let server = http.createServer(
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

let port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 1612;

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
```

The `remix/node-fetch-server` package bridges Node-style request/response objects to the standard `fetch` API that the Remix server entry exports. The server entry itself exports a `fetch(request: Request): Response` function, which is the same interface used across all deployment targets.

During development, `vite` starts the dev server with HMR. For production, `vite build` produces the `dist/` output and `node server.ts` runs the Express server against it.

### Cloudflare Workers

A Cloudflare deployment replaces the plugin's built-in server handler with the `@cloudflare/vite-plugin`, which handles the worker environment and deployment.

#### `vite.config.ts`

The key differences from Node: `serverHandler` is set to `false` (Cloudflare's plugin manages the server), and the `cloudflare()` plugin is added pointing at the `ssr` environment:

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "./remix.plugin.ts";
import { defineConfig } from "vite";

export default defineConfig({
    environments: {
        client: {
            build: {
                rollupOptions: {
                    input: "src/entry.browser",
                },
            },
        },
    },
    plugins: [
        remix({ serverHandler: false }),
        cloudflare({
            viteEnvironment: { name: "ssr" },
        }),
    ],
});
```

Notice there is no explicit `ssr` environment config or `builder.buildApp` hook — the Cloudflare plugin creates and manages the SSR environment itself, including output directories and build ordering.

#### `wrangler.jsonc`

The Wrangler config points at the server entry module:

```jsonc
{
    "name": "my-remix-app",
    "compatibility_date": "2025-10-12",
    "main": "./src/entry.server",
}
```

#### Server entry as a Worker

The server entry exports a Cloudflare Workers-compatible `fetch` handler via `export default`. Since Workers natively use the `fetch` API, no adapter like `node-fetch-server` is needed:

```tsx
// app/entry.server.tsx
import { createRouter, route, type RouteHandlers } from "remix/fetch-router";
import { Document } from "~/components/document.tsx";
import { Counter } from "~/assets/counter.tsx";
import { html } from "~/lib/render.tsx";

const routes = route({ home: "/" });
const router = createRouter();

const handlers = {
    home() {
        return html(
            router,
            <Document>
                <h1>Hello, World!</h1>
                <Counter />
            </Document>,
        );
    },
} satisfies Controller<typeof routes>;

router.map(routes, handlers);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
```

The `vite preview` command uses the Cloudflare plugin to run a local Miniflare instance against the production build, giving you a near-identical environment to what runs on Cloudflare's edge.

## Design Decisions

### Why `clientEntry(import.meta.url, fn)` instead of `"use client"`

The previous approach used a `"use client"` directive and performed significant AST surgery: finding all exports, removing the `export` keyword, re-adding them as wrapped versions, conditionally injecting the `hydrated` import, and stripping the directive on the client. The new approach requires only a single `overwrite` per `clientEntry` call and one `prepend` per file. The transform is explicit, predictable, and easy to debug.

### Why transform in all environments

Both server and client need the resolved asset string. The server uses it to emit hydration markers referencing the client chunk. The client uses it to know which module to load. The `?assets=<envName>` query resolves to the correct chunks for each environment.

### Why `entry` instead of a chunk array

The previous plugin JSON-serialized an array of all chunk URLs because the old client API would `Promise.all` over them. Remix 3's `run()` API takes a single `moduleUrl` and calls `import(moduleUrl)`, so only the entry chunk URL is needed. The bundler handles chunk splitting and loading internally.
