# Remix Vite Plugin

A Vite+ plugin (`remix.plugin.ts`) that wires Remix 3 into a Vite+ project. It orchestrates the SSR and client builds, transforms `clientEntry(import.meta.url, fn)` calls so that `import.meta.url` resolves to a production asset URL with an `#ExportName` fragment, runs a preview server backed by the built SSR entry, and smooths over a few rough edges (disconnect-aborted requests, builder coordination with other plugins).

This document is both a **usage guide** for the plugin and a **specification** complete enough to rebuild the plugin from scratch — every behavior, option, and edge case the current implementation handles is described here.

## Context

### What the plugin does

Remix 3 uses a `clientEntry` function to mark components for client-side hydration. Authors write:

```tsx
import { clientEntry } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
    // component logic
});
```

At build time, `import.meta.url` is meaningless — it's just the source file path. The plugin replaces it with the resolved production asset entry URL plus a `#ExportName` fragment, so at runtime the value becomes something like `/assets/counter-abc123.js#Counter`.

On the server, `clientEntry` uses that string to emit hydration markers and a data script into the HTML. On the client, the `run()` boot function parses the string, calls `loadModule(moduleUrl, exportName)` to dynamically import the chunk, and hydrates the component against the existing DOM.

### Toolchain

This plugin targets **Vite+** (Vite 8 with Rolldown as the default bundler). Key implications:

- Import `defineConfig` and types from `vite-plus`, not `vite`.
- Rolldown provides `meta.ast` (oxc-parsed AST) and `meta.magicString` (native Rust MagicString) in the `transform` hook during build — but these are not available during dev. The plugin must fall back to parsing the AST itself and rewriting strings manually for the dev path.
- The transform hook supports a declarative `filter` object for fast native-level filtering before entering JS.
- AST types come from `oxc-parser` (the `Program` type). Nodes have `start`/`end` as first-class numeric properties.
- Dev server, build, and preview commands are `vp dev`, `vp build`, and `vp preview`.
- Check, lint, format, and test are `vp check`, `vp lint`, `vp fmt`, and `vp test`.

### Dependencies

The plugin depends on `@hiogawa/vite-plugin-fullstack`, which provides:

- **`?assets=<envName>` import query**: importing a module with `?assets=client` (or `?assets=ssr`, etc.) returns an object with `{ entry: string, css: Array<{href}>, js: Array<{href}> }` — the resolved production asset URLs for that module in the given environment.
- **Server handler wiring**: optional — configurable via `serverHandler` option.
- **`mergeAssets` runtime utility**: exported from `@hiogawa/vite-plugin-fullstack/runtime`.
- **`writeAssetsManifest`**: a builder method that copies SSR assets into the client output directory.

The plugin also uses `oxc-parser` as a dev dependency for the `Program` type and as a runtime fallback parser when the Rolldown-only `meta.ast` is unavailable (i.e. during dev).

## Plugin Architecture

The plugin is a Vite plugin array containing five entries:

1. **`fullstack`** (from `@hiogawa/vite-plugin-fullstack`) — handles multi-environment builds and the `?assets` query.
2. **`remix-build:compat`** — patches the builder so the plugin's own build orchestration coexists with plugins that also orchestrate builds (e.g. `@cloudflare/vite-plugin`). Runs at `order: "pre"` so guards are in place before any building starts.
3. **`remix-build`** — sets default environment configuration (output dirs, rollup inputs, `assetsInlineLimit: 0`) and orchestrates the build order: SSR first, then client.
4. **`remix-preview-server`** — wires the built SSR entry into `vp preview` as a request listener. Skips itself when the SSR bundle targets a non-Node runtime (e.g. Cloudflare Workers).
5. **`remix-suppress-abort-errors`** — suppresses `aborted` errors from client disconnects (e.g. search-as-you-type) that would otherwise trigger Vite's error overlay.
6. **`remix-client-entry-transform`** — the actual `clientEntry` code transform.

### Transform Logic

The transform runs in **all environments** (both client and server). Both need the resolved asset URL:

- **Server**: `clientEntry` uses the URL string to write hydration markers into the rendered HTML.
- **Client**: `clientEntry` uses the URL string to identify which chunk to load when the `run()` boot function hydrates the component.

The transform behavior differs slightly by environment:

- **In a server environment** (i.e. `this.environment.name` is in `serverEnvironments`): prepend an import of `?assets=client` so the server can compute the client chunk URL, and overwrite each `import.meta.url` argument with `___clientEntryAssets.entry + "#ExportName"`.
- **In a client environment**: don't prepend anything — `import.meta.url` already resolves to the chunk URL at runtime. Just append `#ExportName` so `clientEntry` receives the required fragment: `import.meta.url + "#ExportName"`.

### Multiple `clientEntry` calls per file

Multiple exports in the same file share one asset import (in server environments). The prepend happens once per file. Each `clientEntry` call gets its own `#ExportName` suffix derived from the variable name of the export.

Given this source on the server side:

```tsx
export const Counter = clientEntry(import.meta.url, handle => { ... });
export const Toggle = clientEntry(import.meta.url, handle => { ... });
```

The transform produces:

```tsx
import ___clientEntryAssets from "<id>?assets=client";
export const Counter = clientEntry(___clientEntryAssets.entry + "#Counter", handle => { ... });
export const Toggle = clientEntry(___clientEntryAssets.entry + "#Toggle", handle => { ... });
```

On the client, the same source becomes:

```tsx
export const Counter = clientEntry(import.meta.url + "#Counter", handle => { ... });
export const Toggle = clientEntry(import.meta.url + "#Toggle", handle => { ... });
```

## Plugin Options

```ts
remix({
    clientEntry: "app/entry.browser", // default — set to `false` for server-only deployments
    serverEntry: "app/entry.server", // default
    serverEnvironments: ["ssr"], // default — which environments are "server"
    serverHandler: true, // default — let `fullstack` wire the dev server handler
});
```

| Option               | Type              | Default               | Purpose                                                                                                                                                               |
| -------------------- | ----------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientEntry`        | `string \| false` | `"app/entry.browser"` | Module path used as the client `rollupOptions.input`. Pass `false` to disable the client environment entirely (for fully server-rendered apps with no hydration).     |
| `serverEntry`        | `string`          | `"app/entry.server"`  | Module path used as the SSR `rollupOptions.input`. Built as `dist/ssr/index.js`.                                                                                      |
| `serverEnvironments` | `string[]`        | `["ssr"]`             | Names of environments treated as "server" by the transform. The transform prepends a `?assets=client` import in these environments so the server can emit chunk URLs. |
| `serverHandler`      | `boolean`         | `true`                | Forwarded to `fullstack`. Set to `false` when another plugin (e.g. `@cloudflare/vite-plugin`) manages the server environment.                                         |

### What `remix-build` configures

The plugin sets the following defaults via its `config()` hook so that user `vite.config.ts` files can stay minimal:

```ts
{
    build: {
        // Ensure assets are emitted as files (not inlined) so they get hashed URLs
        // that the ?assets= query can resolve.
        assetsInlineLimit: 0,
    },
    environments: {
        client: {
            build: {
                outDir: "dist/client",
                rollupOptions: { input: clientEntry || undefined },
            },
        },
        ssr: {
            build: {
                outDir: "dist/ssr",
                rollupOptions: { input: { index: serverEntry } },
            },
        },
    },
}
```

The `client` environment is omitted when `clientEntry: false`.

### Build orchestration

`buildApp(builder)` runs the SSR environment first, then the client:

```ts
await builder.build(builder.environments.ssr);
if (hasClientEntry) {
    await builder.build(builder.environments.client);
}
```

Order matters: the client build reads the SSR asset manifest (via `?assets=ssr`) when resolving `mergeAssets()` calls, so SSR must be built first.

### Builder compatibility (`remix-build:compat`)

When a second plugin (notably `@cloudflare/vite-plugin`) also implements `buildApp`, both would otherwise re-trigger a full build of every environment. The `remix-build:compat` plugin patches `builder.build` at `order: "pre"` so the second invocation becomes a no-op:

```ts
let originalBuild = builder.build.bind(builder);
builder.build = async environment => {
    if (environment.isBuilt) return;
    return originalBuild(environment);
};
```

Additionally, `@cloudflare/vite-plugin` moves SSR-emitted assets into the client output directory before `fullstack`'s `writeAssetsManifest` copies them, causing `ENOENT` on already-relocated files. The compat plugin wraps `writeAssetsManifest` to swallow that specific `ENOENT`:

```ts
let originalWrite = builder.writeAssetsManifest;
if (originalWrite) {
    builder.writeAssetsManifest = async () => {
        try {
            await originalWrite();
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
        }
    };
}
```

### Preview server (`remix-preview-server`)

`vp preview` should serve the production build using the same SSR entry that production deploys. The plugin's `configurePreviewServer` hook:

1. Resolves the SSR output path from `server.config.environments.ssr.build.outDir` (defaulting to `dist/ssr`).
2. Dynamically imports `<ssrOutDir>/index.js`. If the import fails (e.g. the SSR bundle targets Cloudflare Workers, which provides its own preview), it returns early so other plugins can take over.
3. Pulls the router from `mod.default ?? mod.router`.
4. Imports `createRequestListener` from `remix/node-fetch-server` and registers it as middleware:

```ts
server.middlewares.use(createRequestListener(request => router.fetch(request)));
```

### Abort error suppression (`remix-suppress-abort-errors`)

Vite's dev server surfaces unhandled errors via an overlay. When users abort in-flight requests (rapid typing in a search box, navigating away during a frame fetch), the underlying request stream throws `Error: aborted`. These are expected and noisy, so the plugin installs a connect-style error handler that swallows them:

```ts
server.middlewares.use((err, _req, _res, next) => {
    if (err?.message === "aborted") return;
    next(err);
});
```

### Transform implementation (`remix-client-entry-transform`)

```ts
{
    name: "remix-client-entry-transform",
    transform: {
        filter: {
            code: { include: /\bclientEntry\b/ },
        },
        handler(code, id, _meta) {
            if (!code.includes("import.meta.url")) return;

            // meta.ast and meta.magicString are only present during build (Rolldown).
            // During dev, parse with oxc-parser and do plain string rewrites.
            let meta = _meta as Partial<RolldownTransformMeta> | undefined;
            let ast = meta?.ast ?? parseSync(id, code).program;

            let calls = findClientEntryCalls(ast);
            if (calls.length === 0) return;

            let isServer = serverEnvironments.has(this.environment.name);

            if (isServer) {
                let prepend = `import ___clientEntryAssets from "${id}?assets=client";\n`;

                if (meta?.magicString) {
                    let { magicString } = meta;
                    magicString.prepend(prepend);
                    for (let call of calls) {
                        magicString.overwrite(
                            call.metaUrlStart,
                            call.metaUrlEnd,
                            `___clientEntryAssets.entry + "#${call.exportName}"`,
                        );
                    }
                    return { code: magicString };
                }

                // Dev / non-Rolldown fallback: rewrite from the end backwards so
                // earlier offsets remain valid as we splice.
                let result = code;
                for (let call of [...calls].reverse()) {
                    result =
                        result.slice(0, call.metaUrlStart) +
                        `___clientEntryAssets.entry + "#${call.exportName}"` +
                        result.slice(call.metaUrlEnd);
                }
                return prepend + result;
            }

            // Client environment: import.meta.url already resolves to the chunk URL.
            // Just append #ExportName.
            let result = code;
            for (let call of [...calls].reverse()) {
                result =
                    result.slice(0, call.metaUrlStart) +
                    `import.meta.url + "#${call.exportName}"` +
                    result.slice(call.metaUrlEnd);
            }
            return result;
        },
    },
}
```

### AST Pattern Being Matched

The `findClientEntryCalls` helper walks the top-level body of the module looking for this exact pattern:

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

Key API usage during build:

- **`meta.ast`**: The oxc-parsed AST. Provided by Rolldown on the `transform` call. Only present during build, not dev.
- **`meta.magicString`**: The native Rust MagicString instance. Supports `.prepend()`, `.append()`, `.overwrite()`, `.appendLeft()`, `.remove()`, etc. Return `{ code: magicString }` — Rolldown generates the sourcemap natively in a background thread.
- **`transform.filter`**: Declarative filter evaluated in Rust before the JS handler runs. The `code.include` regex skips files that don't contain `clientEntry` without entering JS at all.
- **`this.environment.name`**: The current build environment name (e.g. `"client"`, `"ssr"`). Used to decide whether to emit the server-side `?assets=client` prepend.

During dev (where `meta.ast` and `meta.magicString` are absent), the plugin parses with `oxc-parser`'s `parseSync` and performs string rewrites. Source maps are skipped on the dev path; the impact is minimal since the only edits are short string replacements.

### Dependencies

```json
{
    "dependencies": {
        "@hiogawa/vite-plugin-fullstack": "^0.0.11"
    },
    "devDependencies": {
        "oxc-parser": "^0.121.0"
    }
}
```

`magic-string` is **not** needed — the native implementation is provided by Rolldown during build, and the dev fallback uses plain `String.prototype.slice`.

## Usage in an App

### `vite.config.ts`

The plugin sets sensible defaults (entry paths, output dirs, `assetsInlineLimit`, build order), so most apps need only this:

```ts
import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix()],
});
```

Override defaults only when needed:

```ts
remix({
    clientEntry: "app/entry.browser", // default — set to `false` for server-only apps
    serverEntry: "app/entry.server", // default
    serverEnvironments: ["ssr"], // default
    serverHandler: true, // default — set false to let another plugin manage the server
});
```

### Component authoring

```tsx
// app/components/counter.tsx
import { clientEntry, on, type Handle } from "remix/ui";
import confetti from "canvas-confetti";

export const Counter = clientEntry(import.meta.url, handle => {
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
// app/components/widgets.tsx
import { clientEntry, on, type Handle } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
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

export const Toggle = clientEntry(import.meta.url, (handle: Handle<{ label: string }>) => {
    let open = false;
    let props = handle.props;
    return () => (
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
// app/entry.browser.ts
import { run } from "remix/ui";

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
// app/components/Document.tsx
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";

import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";

export function Document({ children }) {
    const assets = mergeAssets(clientAssets, serverAssets);

    return () => (
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

## Deployment

The plugin works across different deployment targets. The key difference between targets is how the server environment is configured and how the production server serves assets and handles requests. The client build and component authoring stay the same regardless of target.

### Node

For a Node deployment, the plugin's defaults are sufficient — no extra configuration is needed.

#### `vite.config.ts`

```ts
import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix()],
});
```

The plugin's `config()` hook defines the `client` and `ssr` environments (`dist/client`, `dist/ssr`). Its `buildApp` hook builds SSR first, then the client, so the client build can resolve `?assets=ssr` against an existing SSR manifest. `serverHandler: true` (the default) tells `fullstack` to wire the dev server handler automatically, and `vp preview` is handled by `remix-preview-server` — no Express, no glue code.

#### Production server

In production, run the SSR entry under Node's `http` server with `createRequestListener()` from `remix/node-fetch-server`, which adapts Node's request/response objects to the standard Fetch API:

```ts
// server.ts
import * as http from "node:http";

import { createRequestListener } from "remix/node-fetch-server";

// @ts-expect-error - no types for the built output
import ssr from "./dist/ssr/index.js";

let router = ssr.default ?? ssr.router;

let server = http.createServer(createRequestListener(request => router.fetch(request)));

let port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
```

Behind a trusted reverse proxy (nginx, a load balancer), pass `trustProxy: true` so `request.url` and the client address reflect the `Forwarded` / `X-Forwarded-*` headers:

```ts
let server = http.createServer(
    createRequestListener(request => router.fetch(request), { trustProxy: true }),
);
```

Static asset serving (`/dist/client`, `/public`) is handled by `staticFiles()` middleware composed inside the server entry's router rather than by a separate static-file layer in `server.ts`. That keeps a single source of truth for routing — middleware order (and therefore caching headers) lives next to the rest of the request stack instead of being split between `server.ts` and your router.

The SSR entry exports a `fetch(request: Request): Response` function (typically as the default export of a `createRouter()` instance), which is the same interface used across all deployment targets.

#### `package.json` scripts

```json
{
    "scripts": {
        "dev": "vp dev",
        "build": "vp build",
        "preview": "vp preview",
        "start": "node server.ts"
    }
}
```

`vp dev` starts the dev server with HMR. `vp build` produces the `dist/` output. `vp preview` runs the built SSR entry through the plugin's preview middleware. `node server.ts` runs the production server against the build output.

### Cloudflare Workers

A Cloudflare deployment delegates the server environment to `@cloudflare/vite-plugin`, which handles the worker environment, asset serving, and deployment.

#### `vite.config.ts`

The key differences from Node: `serverHandler: false` (Cloudflare's plugin manages the server) and the `cloudflare()` plugin pointed at the `ssr` environment.

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), cloudflare({ viteEnvironment: { name: "ssr" } })],
});
```

The `remix-build:compat` plugin coordinates with `@cloudflare/vite-plugin`'s `buildApp` hook so neither plugin re-builds environments the other has already built, and so `writeAssetsManifest`'s `ENOENT` failures (caused by Cloudflare relocating SSR assets early) are silently tolerated. You don't need to write a custom `builder.buildApp` hook — the plugin handles ordering internally.

#### `wrangler.jsonc`

The Wrangler config points at the server entry module:

```jsonc
{
    "name": "my-remix-app",
    "main": "./app/entry.server.tsx",
    "assets": { "directory": "dist/client" },
    "compatibility_date": "2026-04-02",
    "compatibility_flags": ["nodejs_compat"],
}
```

#### Server entry as a Worker

The server entry exports a Cloudflare Workers-compatible `fetch` handler. Since Workers natively use the Fetch API, no adapter is needed:

```tsx
// app/entry.server.tsx
import { Document } from "#/components/Document.tsx";
import { Counter } from "#/components/Counter.tsx";
import { createRouter } from "remix/router";
import { createHtmlResponse as html } from "remix/response/html";
import { route } from "remix/routes";

const routes = route({ home: "/" });
const router = createRouter();

router.map(routes.home, () =>
    html(
        <Document>
            <h1>Hello, World!</h1>
            <Counter />
        </Document>,
    ),
);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
```

#### `package.json` scripts

```json
{
    "scripts": {
        "dev": "vp dev",
        "build": "vp build",
        "preview": "vp preview",
        "deploy": "wrangler deploy"
    }
}
```

`vp preview` runs a local Miniflare instance against the production build, giving you a near-identical environment to what runs on Cloudflare's edge.

### Shared patterns across targets

Regardless of deployment target, the following pieces are identical:

- **Component authoring** — `clientEntry(import.meta.url, fn)` calls, the component model, and event handling are all target-agnostic.
- **`Document` component** — the `mergeAssets` call, asset `<link>` tags, and the client entry `<script>` tag are the same.
- **`entry.browser.ts`** — the client boot code (`run()`) is identical since it runs in the browser regardless of where the server lives.
- **`createHtmlResponse` / response helpers** — the `renderToStream` call and response construction are the same, since both targets use the standard `Response` API.

The only things that change per target are the plugin options (`serverHandler`), whether `@cloudflare/vite-plugin` is in the plugin array, and how the production server is launched (`node:http` + `remix/node-fetch-server`'s `createRequestListener()` for Node vs. Workers' `export default { fetch }`).

## How Hydration Works End-to-End

1. **Build time**: The plugin replaces `import.meta.url` inside `clientEntry()` calls. In server environments it becomes `___clientEntryAssets.entry + "#Counter"` (resolving via `?assets=client`); in client environments it becomes `import.meta.url + "#Counter"`. Either way, the runtime value is something like `/assets/counter-a1b2c3.js#Counter`.
2. **Server render**: `clientEntry` renders the component to HTML, wrapping output in `<!-- rmx:h:id -->` / `<!-- /rmx:h -->` comment markers. Props are serialized into a `<script type="application/json" id="rmx-data">` tag.
3. **Client boot**: `run()` parses the data script, finds the markers, splits each entry's URL on `#` to get `moduleUrl` and `exportName`, and calls `loadModule`.
4. **Hydration**: The loaded component function is called against the existing DOM. Matching elements are adopted in place.

## Design Decisions

### Why `clientEntry(import.meta.url, fn)` instead of `"use client"`

A directive-based approach would require significant AST surgery: finding all exports, removing the `export` keyword, re-adding them as wrapped versions, conditionally injecting a `hydrated` import, and stripping the directive on the client. The `clientEntry` approach requires only a single `overwrite` per call and one `prepend` per file (and only on the server). The transform is explicit, predictable, and easy to debug.

### Why transform in all environments

Both server and client need the resolved asset string. The server uses it to emit hydration markers referencing the client chunk; the client uses it to know which module to load. The `?assets=<envName>` query resolves to the correct chunks per environment, but only the server actually needs the prepended import — on the client, `import.meta.url` already resolves to the chunk URL at runtime, so the transform skips the prepend there.

### Why `entry` instead of a chunk array

A previous iteration JSON-serialized an array of all chunk URLs because the old client API would `Promise.all` over them. Remix 3's `run()` API takes a single `moduleUrl` and calls `import(moduleUrl)`, so only the entry chunk URL is needed. The bundler handles chunk splitting and loading internally.

### Why a separate `remix-build:compat` plugin

`@cloudflare/vite-plugin` and the plugin both want to drive `buildApp`. Without coordination, both would call `builder.build(env)` for every environment, doubling build work and producing ENOENTs when one moves files the other expects. Patching `builder.build` and `writeAssetsManifest` in a `pre`-ordered plugin guarantees the guards are in place before either build hook runs, regardless of plugin registration order.

### Why suppress `aborted` errors specifically

Common UX patterns (search-as-you-type, navigating away mid-fetch) deliberately abort in-flight requests. Vite's default error handling treats the resulting `Error: aborted` as a real failure and shows the overlay. Filtering by `err.message === "aborted"` is narrow enough to not mask real bugs and broad enough to cover the practical sources of the noise.

### Why preview server is a no-op when SSR import fails

When deploying to Cloudflare Workers, the SSR bundle imports `cloudflare:workers` and other non-Node-resolvable modules. Trying to `import()` it under Node would crash `vp preview`. Instead, the plugin catches the import failure and returns early, letting `@cloudflare/vite-plugin`'s preview middleware take over.
