---
name: remix-document
description: >
    Use when wiring up the document shell with asset imports (?assets=client, ?assets=ssr, ?url), using mergeAssets() for CSS and JS preloads, implementing a dynamic Title component for frame navigations, or connecting stylesheets and scripts in the HTML head.
---

# Remix Document

## Dynamic `<Title>` Component

Frame navigations don't trigger full page loads, so `<title>` in `<head>` never changes. Use a hydrated `<Title>` component:

```tsx
import { clientEntry } from "remix/component";
import { isServer } from "#/utils/navigating.ts";

export let Title = clientEntry(import.meta.url, () => {
    return ({ children }: { children: string | string[] }) => {
        let title = Array.isArray(children) ? children.join("") : children;

        if (isServer) {
            // Inline script sets document.title during HTML parsing,
            // before hydration JS loads, eliminating the flash of the default title.
            return <script>{`document.title=${JSON.stringify(title)}`}</script>;
        } else {
            // Client title changes for navigating between frames.
            document.title = title;
        }
    };
});
```

### Usage in Frame Content

```tsx
export function PostDetail() {
    return (props: { post: Post }) => (
        <div>
            <Title>{props.post.title} | My App</Title>
            <h1>{props.post.title}</h1>
        </div>
    );
}
```

### How It Works

- **Server:** Renders an inline `<script>` that sets `document.title` during HTML parsing. Runs before hydration JS loads, avoiding a flash of the default title from `<head>`.
- **Client:** Sets `document.title` directly during the render phase when navigating between frames.

The base `<title>` tag in your document's `<head>` serves as the default for initial load and no-JS environments.

## Asset Imports

Use Vite's asset import specifiers to resolve paths at build time. Never hardcode asset paths.

### The Three Import Types

```tsx
// Client entry module -- resolves hydration script + its dependencies
import clientAssets from "#/entry.browser.ts?assets=client";

// SSR assets -- resolves server-rendered module dependencies (CSS, JS preloads)
import serverAssets from "#/entry.server.tsx?assets=ssr";

// Standalone stylesheet -- resolves to a URL string
import styles from "#/index.css?url";
```

### Rules

| Specifier        | Use for                                     | Returns                       |
| ---------------- | ------------------------------------------- | ----------------------------- |
| `?assets=client` | Client entry module (passed to `run()`)     | Object with `entry`, CSS, JS  |
| `?assets=ssr`    | Server-rendered modules contributing CSS/JS | Object with CSS, JS arrays    |
| `?url`           | Standalone stylesheets                      | Plain URL string for `<link>` |

- Only use `?assets=ssr` for module assets (`.tsx`, `.ts`), not plain `.css` files
- The Remix Vite plugin transforms `import.meta.url` in `clientEntry()` calls into correct `?assets=client` imports automatically

## Document Shell Wiring

Use `mergeAssets()` to combine client and server assets, then render them in `<head>`:

```tsx
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
import styles from "#/index.css?url";

export function Document() {
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                {/* Standalone CSS file */}
                <link href={styles} rel="stylesheet" />

                {/* Asset-resolved CSS from component modules */}
                {css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}

                {/* Client entry script */}
                <script async src={clientAssets.entry} type="module" />

                {/* Preload links for JS dependencies */}
                {js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>{/* frames, etc. */}</body>
        </html>
    );
}
```

### Key Points

- Render `clientAssets.entry` as the `<script>` src -- never hardcode `/remix/assets/...` paths
- `mergeAssets()` deduplicates and combines CSS/JS from both client and server asset manifests
- `css` array contains objects with `href` (and potentially other attributes) for stylesheet `<link>` tags
- `js` array contains objects with `href` for `<link rel="modulepreload">` tags
