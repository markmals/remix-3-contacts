# Metadata utilities

Frame-aware document metadata utilities for Remix UI.

## Component usage

Use lowercase document metadata tags inside `<Head>`:

```tsx
import { Head } from "~/utils/metadata";

function ProductPage(handle) {
    return () => (
        <>
            <Head>
                <title>{handle.props.product.name}</title>
                <meta name="description" content={handle.props.product.description} />
                <meta property="og:title" content={handle.props.product.name} />
                <link rel="canonical" href={`/products/${handle.props.product.slug}`} />
            </Head>

            <main>
                <h1>{handle.props.product.name}</h1>
            </main>
        </>
    );
}
```

## Server usage

Wrap `renderToStream()` with `renderWithMetadata()`:

```tsx
import { renderToStream } from "remix/ui/server";
import { renderWithMetadata, withMetadataFrames } from "~/utils/metadata";

export async function render(request: Request) {
    let stream = await renderWithMetadata(
        renderToStream(<App />, {
            frameSrc: request.url,
            resolveFrame: withMetadataFrames(async (src, signal, target, context) => {
                let url = new URL(src, context?.currentFrameSrc ?? request.url);
                let response = await fetch(url, {
                    headers: {
                        Accept: "text/html",
                        ...(target ? { "X-Remix-Target": target } : {}),
                    },
                    signal,
                });

                return response.body ?? (await response.text());
            }),
        }),
        {
            precedence: ["reset", "base", "theme", "route", "component"],
        },
    );

    return new Response(stream, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
    });
}
```

## Client usage

Hydrate the metadata manager before or near Remix UI runtime startup:

```ts
import { run } from "remix/ui";
import { createMetadataManager, withMetadataFrames } from "~/utils/metadata";

let metadata = createMetadataManager({
    precedence: ["reset", "base", "theme", "route", "component"],
});

metadata.hydrate(document);

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(moduleUrl);
        return mod[exportName];
    },

    resolveFrame: withMetadataFrames(async (src, signal, target) => {
        let response = await fetch(src, {
            headers: {
                Accept: "text/html",
                ...(target ? { "X-Remix-Target": target } : {}),
            },
            signal,
        });

        return response.body ?? (await response.text());
    }),
});

await app.ready();
```

## Rules

- `<title>` is singleton and last-writer-wins.
- `<meta itemProp>` is ignored.
- `<link rel="stylesheet">` requires `href` and `precedence`.
- `<style>` requires `href` and `precedence`.
- `<script>` requires `src` and `async`.
- Replaceable metadata is removed when its owning `<Head>` template disappears.
- Sticky resources such as stylesheets, async scripts, and preloads remain after the owner disappears.

## Tradeoff

`renderWithMetadata()` buffers the whole SSR stream. That is the external-userland cost of injecting child/frame metadata into the initial document `<head>` without Remix core renderer hooks.
