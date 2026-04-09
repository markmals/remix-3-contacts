# Convex Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the contacts app from D1/R2 to Convex as the sole data layer, with client-side mutations, real-time subscriptions, Convex file storage, and simplified server routing.

**Architecture:** Server renders the initial full-page HTML using `ConvexHttpClient`. After hydration, `clientEntry` components subscribe to Convex for real-time updates and call mutations directly via `ConvexClient` (browser). The detail pane still uses frame navigation for show/edit transitions. The sidebar is a reactive `clientEntry` that server-renders on first paint, then self-updates via subscription.

**Tech Stack:** Remix 3 (alpha), Convex, Vite+, Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-04-08-convex-migration-design.md`

---

## File Map

### Files to create

| File | Responsibility |
|------|---------------|
| `convex/files.ts` | Convex file storage: `generateUploadUrl` mutation |
| `app/components/SidebarList.tsx` | `clientEntry` that renders the sidebar contact list + search + New button, subscribes to `api.contacts.list` |

### Files to modify

| File | Changes |
|------|---------|
| `convex/schema.ts` | Change `avatar` from `v.optional(v.string())` to `v.optional(v.id("_storage"))` |
| `convex/contacts.ts` | Resolve storage IDs to URLs in `get` and `list` queries; update `create`/`update` to accept `v.optional(v.id("_storage"))` for avatar |
| `convex/migration.ts` | Remove `avatar` strings from seed data (they reference external URLs, not Convex storage IDs) |
| `app/utils/convex.tsx` | Export the shared `ConvexClient` instance so all components use one client |
| `app/data/contacts.ts` | Remove `createContact`, `updateContact`, `deleteContact`, `fakeNetwork`; keep `getContacts`, `getContact` for SSR |
| `app/data/schemas.ts` | Remove `FavoriteSchema`, `UpdateSchema`, `DeleteSchema`; keep `QuerySchema`, `IdSchema` |
| `app/routes.ts` | Replace `resources()` + `patch()` with explicit `get()` routes for show/edit only |
| `app/entry.server.tsx` | Remove `formData`, `methodOverride` middleware; remove uploads route; simplify home route (no sidebar frame target) |
| `app/entry.browser.ts` | Remove form POST interceptor (mutations are client-side now) |
| `app/controllers/contacts.tsx` | Remove `create`, `destroy`, `favorite`, `update` actions; simplify `show`/`edit` to handle frame vs document |
| `app/utils/frame.tsx` | Remove `"sidebar"` from `Frame.Name` union |
| `app/utils/render.tsx` | Remove `sidebar()` function; update `document()` to query contacts and pass to `SidebarList` inline |
| `app/components/Document.tsx` | Replace sidebar `<Frame>` with inline `<SidebarList>`; remove `RestfulForm` import |
| `app/components/ShowContact.tsx` | Use shared `ConvexClient` from `app/utils/convex.tsx` instead of creating its own; remove `RestfulForm` usage |
| `app/components/Favorite.tsx` | Rewrite to use `mutate()` mixin with `api.contacts.toggleFavorite`; remove fetch-based optimistic UI |
| `app/components/Buttons.tsx` | Rewrite `DeleteButton` to use direct `on("submit")` handler with navigation; remove `RestfulForm` and `mutate` usage |
| `app/components/EditContact.tsx` | Convert to `clientEntry`; handle form submission client-side with Convex file upload |
| `app/components/SidebarItem.tsx` | Update `contact.id` type from `number` to `string` (Convex IDs are strings) |
| `wrangler.jsonc` | Remove `d1_databases` and `r2_buckets` bindings |

### Files to delete

| File | Reason |
|------|--------|
| `app/controllers/uploads.ts` | R2 file serving/upload replaced by Convex file storage |
| `app/data/adapters/r2-file-storage.ts` | R2 adapter no longer needed |
| `app/data/adapters/d1-data-table.ts` | D1 adapter, already unused |
| `app/components/RestfulForm.tsx` | No more method override needed — no PUT/PATCH/DELETE to server |
| `app/components/SearchBar.tsx` | Merged into `SidebarList` |

---

## Task 1: Convex file storage backend

**Files:**
- Create: `convex/files.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/contacts.ts`
- Modify: `convex/migration.ts`

- [ ] **Step 1: Add `generateUploadUrl` mutation**

Create `convex/files.ts`:

```ts
import { mutation } from "./_generated/server";

export let generateUploadUrl = mutation({
    args: {},
    handler: async ctx => {
        return await ctx.storage.generateUploadUrl();
    },
});
```

- [ ] **Step 2: Update schema — avatar becomes storage ID**

In `convex/schema.ts`, change:

```ts
avatar: v.optional(v.string()),
```

to:

```ts
avatar: v.optional(v.id("_storage")),
```

- [ ] **Step 3: Update `get` query to resolve avatar URL**

In `convex/contacts.ts`, update the `get` query:

```ts
export let get = query({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        let contact = await ctx.db.get(args.id);
        if (!contact) return null;
        let avatarUrl = contact.avatar ? await ctx.storage.getUrl(contact.avatar) : null;
        return { ...contact, avatarUrl };
    },
});
```

- [ ] **Step 4: Update `list` query to resolve avatar URLs**

In `convex/contacts.ts`, update the `list` query to resolve avatar URLs for each contact:

```ts
export let list = query({
    args: { query: v.optional(v.string()) },
    handler: async (ctx, args) => {
        let contacts = await ctx.db.query("contacts").withIndex("by_last").collect();

        if (args.query) {
            contacts = matchSorter(contacts, args.query, {
                keys: ["first", "last"],
            });
        }

        let sorted = sortBy(contacts, [c => c.last, c => c._creationTime]);

        return Promise.all(
            sorted.map(async contact => {
                let avatarUrl = contact.avatar
                    ? await ctx.storage.getUrl(contact.avatar)
                    : null;
                return { ...contact, avatarUrl };
            }),
        );
    },
});
```

- [ ] **Step 5: Update `create` and `update` mutations for storage ID avatar**

In `convex/contacts.ts`, update the `create` mutation's `avatar` arg:

```ts
avatar: v.optional(v.id("_storage")),
```

And the `update` mutation's `avatar` arg:

```ts
avatar: v.optional(v.id("_storage")),
```

- [ ] **Step 6: Remove avatar URLs from seed data**

In `convex/migration.ts`, remove the `avatar` field from each seed contact (external URLs are not Convex storage IDs):

```ts
const SEED_CONTACTS = [
    {
        first: "Brooks",
        last: "Lybrand",
        bsky: "brookslybrand.bsky.social",
        favorite: false,
    },
    {
        first: "Mark",
        last: "Dalgleish",
        bsky: "markdalgleish.com",
        favorite: false,
    },
    {
        first: "Pedro",
        last: "Cattori",
        bsky: "pedrocattori.com",
        favorite: false,
    },
    {
        first: "Kent C.",
        last: "Dodds",
        bsky: "kentcdodds.com",
        favorite: false,
    },
    {
        first: "Jacob",
        last: "Ebey",
        bsky: "ebey.bsky.social",
        favorite: false,
    },
];
```

- [ ] **Step 7: Commit**

```bash
git add convex/
git commit -m "feat: add Convex file storage and resolve avatar URLs in queries"
```

---

## Task 2: Export shared ConvexClient + update Contact type

**Files:**
- Modify: `app/utils/convex.tsx`
- Modify: `app/data/contacts.ts`

- [ ] **Step 1: Export the shared `ConvexClient` instance**

In `app/utils/convex.tsx`, the `client` is already module-scoped. Add an export:

```ts
export let client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);
```

(Change `let client` to `export let client`.)

- [ ] **Step 2: Update Contact type and trim data layer**

Replace `app/data/contacts.ts` with:

```ts
import type { Doc } from "#convex/_generated/dataModel.js";

import { api } from "#convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";
import { getContext } from "remix/async-context-middleware";

// The base doc type from Convex
type ContactDoc = Doc<"contacts">;

// Queries return contacts with resolved avatar URLs
export type Contact = Omit<ContactDoc, "avatar"> & {
    avatarUrl: string | null;
    avatar?: ContactDoc["avatar"];
};

export async function getContacts(query?: string): Promise<Contact[]> {
    let client = getContext().get(ConvexHttpClient);
    return await client.query(api.contacts.list, { query: query || undefined });
}

export async function getContact(id?: string): Promise<Contact | null> {
    let client = getContext().get(ConvexHttpClient);
    if (!id) return null;
    return await client.query(api.contacts.get, { id: id as any });
}
```

This removes `createContact`, `updateContact`, `deleteContact`, `fakeNetwork`, and the `CACHE`. The `Contact` type now reflects the resolved `avatarUrl` field from the updated Convex queries.

- [ ] **Step 3: Commit**

```bash
git add app/utils/convex.tsx app/data/contacts.ts
git commit -m "feat: export shared ConvexClient, trim server data layer to read-only"
```

---

## Task 3: Simplify routes, middleware, and frame utilities

**Files:**
- Modify: `app/routes.ts`
- Modify: `app/entry.server.tsx`
- Modify: `app/utils/frame.tsx`
- Modify: `app/data/schemas.ts`
- Delete: `app/controllers/uploads.ts`
- Delete: `app/data/adapters/r2-file-storage.ts`
- Delete: `app/data/adapters/d1-data-table.ts`

- [ ] **Step 1: Simplify routes**

Replace `app/routes.ts` with:

```ts
import { get, route } from "remix/fetch-router/routes";

export let routes = route({
    home: get("/"),
    contacts: {
        show: get("/contacts/:id"),
        edit: get("/contacts/:id/edit"),
    },
});
```

- [ ] **Step 2: Remove `"sidebar"` from Frame.Name**

In `app/utils/frame.tsx`, change:

```ts
export const Name = s.union([s.literal("detail" as const), s.literal("sidebar" as const)]);
```

to:

```ts
export const Name = s.literal("detail" as const);
```

- [ ] **Step 3: Trim schemas**

Replace `app/data/schemas.ts` with:

```ts
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

export let QuerySchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

export let IdSchema = s.object({ id: s.string() });
```

Keep `QuerySchema` as `f.object`/`f.field` because it's parsed from `URLSearchParams` via `s.parse()`, which needs the form-data schema variant. Remove `FavoriteSchema`, `UpdateSchema`, `DeleteSchema`, and the `coerce` import.

- [ ] **Step 4: Simplify middleware stack in entry.server.tsx**

In `app/entry.server.tsx`, remove the `formData` and `methodOverride` imports and their usage in the middleware array. Also remove the `serveUpload` and `uploadHandler` imports and the `router.map(routes.uploads, serveUpload)` line.

The middleware array becomes:

```ts
middleware: [
    staticFiles("./public"),
    staticFiles("./dist/client"),
    asyncContext(),
    loadConvex(),
    frameTarget(),
],
```

Remove these imports:
- `import { serveUpload, uploadHandler } from "#/controllers/uploads.ts";`
- `import { formData } from "remix/form-data-middleware";`
- `import { methodOverride } from "remix/method-override-middleware";`

- [ ] **Step 5: Simplify home route handler**

In `app/entry.server.tsx`, simplify the home route handler. It no longer needs the sidebar frame target check:

```ts
router.map(routes.home, async ctx => {
    if (ctx.get(Frame.Target).is("detail")) return frame(<ZeroState />);
    return await document();
});
```

- [ ] **Step 6: Delete R2/D1 files**

Delete these files:
- `app/controllers/uploads.ts`
- `app/data/adapters/r2-file-storage.ts`
- `app/data/adapters/d1-data-table.ts`

- [ ] **Step 7: Clean up wrangler.jsonc**

Replace `wrangler.jsonc` with:

```jsonc
{
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "remix-3-contacts",
    "main": "./app/entry.server.tsx",
    "assets": { "directory": "dist/client" },
    "compatibility_date": "2026-04-02",
    "compatibility_flags": ["nodejs_compat"]
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: simplify routes, middleware, and frame logic; remove R2/D1"
```

---

## Task 4: Simplify contacts controller to show/edit only

**Files:**
- Modify: `app/controllers/contacts.tsx`

- [ ] **Step 1: Rewrite contacts controller**

Replace `app/controllers/contacts.tsx` with:

```tsx
import type { Controller } from "remix/fetch-router";

import { EditContact } from "#/components/EditContact.tsx";
import { ShowContact } from "#/components/ShowContact.tsx";
import { getContact } from "#/data/contacts.ts";
import { QuerySchema, IdSchema } from "#/data/schemas.ts";
import { routes } from "#/routes.ts";
import { createFrameResponse as frame, Frame } from "#/utils/frame.tsx";
import { document } from "#/utils/render.tsx";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";

export default {
    actions: {
        async show(ctx) {
            let target = ctx.get(Frame.Target);

            if (target.is("detail")) {
                let { q } = s.parse(QuerySchema, ctx.url.searchParams);
                let { id } = s.parse(IdSchema, ctx.params);
                let contact = await getContact(id);
                if (!contact) return redirect(routes.home.href());
                return frame(<ShowContact initial={contact} query={q} />);
            }

            return await document();
        },
        async edit(ctx) {
            let target = ctx.get(Frame.Target);

            if (target.is("detail")) {
                let { id } = s.parse(IdSchema, ctx.params);
                let contact = await getContact(id);
                if (!contact) return redirect(routes.home.href());
                return frame(<EditContact contact={contact} />);
            }

            return await document();
        },
    },
} satisfies Controller<typeof routes.contacts>;
```

- [ ] **Step 2: Commit**

```bash
git add app/controllers/contacts.tsx
git commit -m "feat: simplify contacts controller to show/edit frame responses"
```

---

## Task 5: Reactive sidebar — SidebarList + inline rendering

**Files:**
- Create: `app/components/SidebarList.tsx`
- Modify: `app/components/SidebarItem.tsx`
- Modify: `app/utils/render.tsx`
- Modify: `app/components/Document.tsx`
- Delete: `app/components/SearchBar.tsx`

- [ ] **Step 1: Update SidebarItem props — ID type**

In `app/components/SidebarItem.tsx`, update the `Props` interface. Change `id: number` to `id: string` and update all comparisons:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { routes } from "#/routes.ts";
import { link } from "#/utils/frame.tsx";
import { isServer, navigating } from "#/utils/navigating.ts";
import { addEventListeners, clientEntry, type SerializableProps } from "remix/component";
import { ArrayMatcher } from "remix/route-pattern";

let matcher = new ArrayMatcher<true>();
matcher.add(routes.contacts.show.pattern, true);
matcher.add(routes.contacts.edit.pattern, true);

export namespace SidebarItem {
    export interface Props extends SerializableProps {
        selected: string;
        query?: string;

        contact: {
            id: string;
            first?: string;
            last?: string;
            favorite?: boolean;
        };
    }
}

export let SidebarItem = clientEntry(import.meta.url, handle => {
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return ({ selected, query, contact }: SidebarItem.Props) => {
        let currentMatch = !isServer ? matcher.match(location.href) : null;
        let isActive = (currentMatch?.params?.id ?? selected) === contact.id;

        let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
        let isPathChange = !isServer && navigating.to.url?.pathname !== location.pathname;
        let isPending = !isActive && isPathChange && destination?.params.id === contact.id;

        return (
            <li>
                <a
                    class={isActive ? "active" : isPending ? "pending" : undefined}
                    href={routes.contacts.show.href({ id: contact.id }, { q: query })}
                    mix={link({ target: "detail" })}
                >
                    {contact.first || contact.last ? (
                        <>
                            {contact.first} {contact.last}
                        </>
                    ) : (
                        <i>No Name</i>
                    )}
                    {contact.favorite ? <span>{"\u2605"}</span> : null}
                </a>
            </li>
        );
    };
});
```

- [ ] **Step 2: Create SidebarList component**

Create `app/components/SidebarList.tsx`. This combines the search bar, New button, and contact list into a single `clientEntry` that subscribes to the contact list:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { SidebarItem } from "#/components/SidebarItem.tsx";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { isServer, navigating } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";
import { addEventListeners, clientEntry, navigate, on } from "remix/component";

export let SidebarList = clientEntry(import.meta.url, handle => {
    let contacts: Contact[] = [];
    let query = "";
    let unsubscribe: (() => void) | undefined;

    // Subscribe to contact list after hydration
    if (!isServer) {
        unsubscribe = client.onUpdate(api.contacts.list, {}, update => {
            contacts = update;
            handle.update();
        });

        handle.signal.addEventListener("abort", () => unsubscribe?.());
    }

    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    function filtered(): Contact[] {
        let list = contacts;
        if (query) {
            list = matchSorter(list, query, { keys: ["first", "last"] });
        }
        return sortBy(list, [c => c.last, c => c._creationTime]);
    }

    return (props: { contacts: Contact[]; query?: string }) => {
        // Use props for initial server render, subscription data after hydration
        if (isServer || contacts.length === 0) {
            contacts = props.contacts;
        }
        query = props.query ?? "";

        let searching = Boolean(navigating.to.url?.searchParams.has("q"));
        let items = filtered();

        return (
            <>
                <div>
                    <form id="search-form" method="GET">
                        <input
                            aria-label="Search contacts"
                            class={searching ? "loading" : ""}
                            defaultValue={query || undefined}
                            id="q"
                            mix={on("input", async event => {
                                try {
                                    let url = new URL(location.href);

                                    if (!event.currentTarget.value.trim()) {
                                        url.searchParams.delete("q");
                                        query = "";
                                        handle.update();
                                        await navigate(url.toString(), {
                                            history: "replace",
                                        });
                                        return;
                                    }

                                    let isFirstSearch = url.searchParams.get("q") === null;
                                    url.searchParams.set("q", event.currentTarget.value);
                                    query = event.currentTarget.value;
                                    handle.update();
                                    await navigate(url.toString(), {
                                        history: isFirstSearch ? "replace" : "push",
                                    });
                                } catch {
                                    // ignore navigation errors caused by abortions during typing
                                }
                            })}
                            name="q"
                            placeholder="Search"
                            type="search"
                        />
                        <div aria-hidden hidden={!searching} id="search-spinner" />
                        <div aria-live="polite" class="sr-only" />
                    </form>
                    <button
                        mix={on("click", async () => {
                            let id = await client.mutation(api.contacts.create, {
                                first: "",
                                last: "",
                                bsky: "",
                            });
                            navigate(routes.contacts.edit.href({ id }), {
                                target: "detail",
                            });
                        })}
                        type="button"
                    >
                        New
                    </button>
                </div>
                <nav>
                    {items.length ? (
                        <ul>
                            {items.map(contact => (
                                <SidebarItem
                                    contact={{
                                        id: contact._id,
                                        first: contact.first,
                                        last: contact.last,
                                        favorite: contact.favorite,
                                    }}
                                    query={query}
                                    selected=""
                                />
                            ))}
                        </ul>
                    ) : (
                        <p>
                            <i>No contacts</i>
                        </p>
                    )}
                </nav>
            </>
        );
    };
});
```

- [ ] **Step 3: Update render.tsx — remove sidebar(), fetch contacts in document()**

Replace `app/utils/render.tsx` with:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { Document } from "#/components/Document.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import { router } from "#/entry.server.tsx";
import { getContext } from "remix/async-context-middleware";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";

export async function document(): Promise<Response> {
    let context = getContext();
    let { q } = s.parse(QuerySchema, context.url.searchParams);
    let contacts = await getContacts(q);

    return html(
        renderToStream(<Document contacts={contacts} query={q} />, {
            frameSrc: context.url,
            async resolveFrame(src, target, ctx) {
                let url = new URL(src, ctx?.currentFrameSrc ?? context.url);
                let headers = new Headers({ accept: "text/html" });
                if (target) headers.set("x-remix-target", target);
                let response = await router.fetch(new Request(url, { headers }));

                if (!response.ok) {
                    throw new Error(`Failed to resolve frame ${url.pathname}`);
                }

                return response.body ?? (await response.text());
            },
        }),
    );
}
```

The `document()` function is now `async` — it fetches contacts before passing them as props to `Document`. This is where the data loading happens, not inside the component.

- [ ] **Step 4: Update Document.tsx — inline SidebarList, remove sidebar Frame**

Replace `app/components/Document.tsx` with:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { SidebarList } from "#/components/SidebarList.tsx";
import { SITE } from "#/data/meta.ts";
import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
import styles from "#/index.css?url";
import { Frame } from "#/utils/frame.tsx";
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import { getContext } from "remix/async-context-middleware";

import { Title } from "./Title.tsx";

export function Document() {
    let { url } = getContext();
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return (props: { contacts: Contact[]; query?: string }) => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <Title>{SITE.title}</Title>

                <link href="/favicon-32.png" rel="icon" sizes="32x32" />
                <link href="/favicon-128.png" rel="icon" sizes="128x128" />
                <link href="/favicon-180.png" rel="icon" sizes="180x180" />
                <link href="/favicon-192.png" rel="icon" sizes="192x192" />
                <link href="/favicon-180.png" rel="apple-touch-icon" sizes="180x180" />

                <link href={styles} rel="stylesheet" />
                {css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}

                <script async src={clientAssets.entry} type="module" />
                {js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>
                <div id="root">
                    <div id="sidebar">
                        <h1>{SITE.title}</h1>
                        <SidebarList contacts={props.contacts} query={props.query} />
                    </div>
                    <Frame name="detail" url={url} />
                </div>
            </body>
        </html>
    );
}
```

`Document` receives `contacts` and `query` as props from the `document()` helper in `render.tsx`, which does the async data fetch. The component itself is fully synchronous.

- [ ] **Step 5: Delete SearchBar.tsx**

Delete `app/components/SearchBar.tsx` — its functionality is now inside `SidebarList`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: reactive sidebar with SidebarList clientEntry and Convex subscription"
```

---

## Task 6: Favorite — switch to mutate() mixin

**Files:**
- Modify: `app/components/Favorite.tsx`

- [ ] **Step 1: Rewrite Favorite component**

Replace `app/components/Favorite.tsx` with:

```tsx
import { mutate } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry } from "remix/component";
import * as f from "remix/data-schema/form-data";
import * as s from "remix/data-schema";

let ToggleFavoriteSchema = f.object({
    id: f.field(s.string()),
});

export let Favorite = clientEntry(import.meta.url, () => {
    return (props: { contactId: string; favorite: boolean }) => (
        <form
            mix={mutate({
                mutation: api.contacts.toggleFavorite,
                schema: ToggleFavoriteSchema,
            })}
        >
            <input name="id" type="hidden" value={props.contactId} />
            <button
                aria-label={props.favorite ? "Remove from favorites" : "Add to favorites"}
                type="submit"
            >
                {props.favorite ? "★" : "☆"}
            </button>
        </form>
    );
});
```

The Convex subscription in `ShowContact` will automatically update the UI when the mutation completes, so no optimistic UI logic is needed in the component itself.

- [ ] **Step 2: Commit**

```bash
git add app/components/Favorite.tsx
git commit -m "feat: Favorite uses mutate() mixin with toggleFavorite"
```

---

## Task 7: DeleteButton — direct mutation with navigation

**Files:**
- Modify: `app/components/Buttons.tsx`

- [ ] **Step 1: Rewrite Buttons.tsx**

Replace `app/components/Buttons.tsx` with:

```tsx
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, navigate, on } from "remix/component";

export let CancelButton = clientEntry(import.meta.url, () => {
    return () => (
        <button
            mix={on("click", () => {
                navigation.back();
            })}
            type="button"
        >
            Cancel
        </button>
    );
});

export let DeleteButton = clientEntry(import.meta.url, () => {
    return (props: { contactId: string }) => (
        <form
            mix={on("submit", async event => {
                event.preventDefault();

                if (!confirm("Please confirm you want to delete this record.")) {
                    return;
                }

                await client.mutation(api.contacts.remove, { id: props.contactId as any });
                navigate(routes.home.href());
            })}
        >
            <button type="submit">Delete</button>
        </form>
    );
});
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Buttons.tsx
git commit -m "feat: DeleteButton calls remove mutation client-side with navigation"
```

---

## Task 8: ShowContact — use shared client, remove RestfulForm

**Files:**
- Modify: `app/components/ShowContact.tsx`

- [ ] **Step 1: Update ShowContact to use shared client and plain forms**

Replace `app/components/ShowContact.tsx` with:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { DeleteButton } from "#/components/Buttons.tsx";
import { Favorite } from "#/components/Favorite.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { link } from "#/utils/frame.tsx";
import { isServer } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { clientEntry } from "remix/component";

import { Title } from "./Title.tsx";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export let ShowContact = clientEntry(import.meta.url, handle => {
    let contact: Contact | null = null;
    let unsubscribe: (() => void) | undefined;

    return (props: { initial: Contact; query?: string }) => {
        contact ??= props.initial;

        if (!isServer && contact._id !== props.initial._id) {
            contact = props.initial;
            unsubscribe?.();

            unsubscribe = client.onUpdate(api.contacts.get, { id: props.initial._id }, update => {
                contact = update;
                handle.update();
            });
        }

        return (
            <div id="detail">
                <Title>
                    {contact.first} {contact.last} | {SITE.title}
                </Title>
                <div id="contact">
                    <div>
                        <img
                            alt=""
                            key={contact.avatarUrl}
                            src={contact.avatarUrl ? contact.avatarUrl : AVATAR_PLACEHOLDER}
                        />
                    </div>

                    <div>
                        <h1>
                            {contact.first || contact.last ? (
                                <>
                                    {contact.first} {contact.last}
                                </>
                            ) : (
                                <i>No Name</i>
                            )}{" "}
                            <Favorite
                                contactId={contact._id}
                                favorite={contact.favorite ?? false}
                            />
                        </h1>

                        {contact.bsky ? (
                            <p>
                                <a
                                    href={`https://bsky.app/profile/${contact.bsky}`}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    @{contact.bsky}
                                </a>
                            </p>
                        ) : null}

                        {contact.notes ? <p>{contact.notes}</p> : null}

                        <div>
                            <a
                                href={routes.contacts.edit.href(
                                    { id: contact._id },
                                    { q: props.query },
                                )}
                                mix={link({ target: "detail" })}
                            >
                                <button type="button">Edit</button>
                            </a>
                            <DeleteButton contactId={contact._id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
});
```

Key changes:
- Uses shared `client` from `app/utils/convex.tsx` instead of creating its own `ConvexClient`
- Uses `contact.avatarUrl` instead of `contact.avatar` for the image src
- Edit button is a plain `<a>` with `link({ target: "detail" })` instead of `RestfulForm`
- `RestfulForm` import removed

- [ ] **Step 2: Commit**

```bash
git add app/components/ShowContact.tsx
git commit -m "feat: ShowContact uses shared ConvexClient and plain links"
```

---

## Task 9: EditContact — clientEntry with Convex file upload

**Files:**
- Modify: `app/components/EditContact.tsx`

- [ ] **Step 1: Convert EditContact to clientEntry with client-side submit**

Replace `app/components/EditContact.tsx` with:

```tsx
import type { Contact } from "#/data/contacts.ts";

import { CancelButton } from "#/components/Buttons.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, navigate, on } from "remix/component";

import { Title } from "./Title.tsx";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];

export let EditContact = clientEntry(import.meta.url, () => {
    return (props: { contact: Contact }) => (
        <div id="detail">
            <Title>
                Edit {props.contact.first} {props.contact.last} | {SITE.title}
            </Title>
            <form
                id="contact-form"
                mix={on("submit", async event => {
                    event.preventDefault();

                    let form = new FormData(event.currentTarget);
                    let avatarFile = form.get("avatar") as File | null;
                    let avatarStorageId = props.contact.avatar;

                    // Upload new avatar if a file was selected
                    if (avatarFile && avatarFile.size > 0) {
                        if (!new Set(ALLOWED_TYPES).has(avatarFile.type)) {
                            alert(
                                "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
                            );
                            return;
                        }

                        let uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
                        let response = await fetch(uploadUrl, {
                            method: "POST",
                            headers: { "Content-Type": avatarFile.type },
                            body: avatarFile,
                        });
                        let { storageId } = await response.json();
                        avatarStorageId = storageId;
                    }

                    await client.mutation(api.contacts.update, {
                        id: props.contact._id as any,
                        first: (form.get("first") as string) || "",
                        last: (form.get("last") as string) || "",
                        bsky: (form.get("bsky") as string) || "",
                        notes: (form.get("notes") as string) || "",
                        avatar: avatarStorageId,
                    });

                    navigate(routes.contacts.show.href({ id: props.contact._id }), {
                        target: "detail",
                    });
                })}
            >
                <label>
                    <span>Name</span>
                    <input
                        aria-label="First name"
                        name="first"
                        placeholder="First"
                        type="text"
                        value={props.contact.first || undefined}
                    />
                    <input
                        aria-label="Last name"
                        name="last"
                        placeholder="Last"
                        type="text"
                        value={props.contact.last || undefined}
                    />
                </label>

                <label>
                    <span>Bluesky</span>
                    <input
                        name="bsky"
                        placeholder="jay.bsky.team"
                        type="text"
                        value={props.contact.bsky || undefined}
                    />
                </label>

                <label>
                    <span>Avatar</span>
                    <div id="contact-form-avatar">
                        <img
                            alt="Current avatar"
                            src={
                                props.contact.avatarUrl ||
                                "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
                            }
                        />
                        <label class="avatar-upload">
                            <input
                                accept={ALLOWED_TYPES.join(",")}
                                hidden
                                name="avatar"
                                type="file"
                            />
                            <span>Choose Photo</span>
                        </label>
                    </div>
                </label>

                <label>
                    <span>Notes</span>
                    <textarea name="notes" rows={6} value={props.contact.notes || undefined} />
                </label>

                <p>
                    <button type="submit">Save</button>
                    <CancelButton />
                </p>
            </form>
        </div>
    );
});
```

Key changes:
- Now a `clientEntry` instead of a server component
- Form submission intercepted with `on("submit")`
- Avatar upload goes through Convex file storage (generate URL → upload → get storage ID)
- Calls `api.contacts.update` mutation directly
- Navigates to show page after save
- Uses `contact.avatarUrl` for display, `contact.avatar` (storage ID) for preserving existing avatar
- `ALLOWED_TYPES` moved inline (was in uploads controller)
- No more `RestfulForm` or `method` override

- [ ] **Step 2: Commit**

```bash
git add app/components/EditContact.tsx
git commit -m "feat: EditContact as clientEntry with Convex file upload"
```

---

## Task 10: Simplify client entry — remove form POST interceptor

**Files:**
- Modify: `app/entry.browser.ts`

- [ ] **Step 1: Remove the form POST navigation interceptor**

Replace `app/entry.browser.ts` with:

```ts
import { run } from "remix/component";

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        let exported = mod[exportName];

        if (typeof exported !== "function") {
            throw new TypeError(
                `Expected export '${exportName}' from '${moduleUrl}' to be a function`,
            );
        }

        return exported;
    },
    async resolveFrame(src, signal, target) {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        let response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    },
});

// Set focusReset to prevent browser auto-reset on non-traverse navigations
navigation.addEventListener("navigate", event => {
    if (
        !event.canIntercept ||
        event.defaultPrevented ||
        event.navigationType === "traverse"
    ) {
        return;
    }

    event.intercept({ focusReset: "manual" });
});
```

Removed:
- The first `navigation.addEventListener("navigate", ...)` block that intercepted form submissions (both GET and POST). Mutations are now client-side, and `<a>` navigations are handled by the built-in `run()` listener.
- The `navigate` import (no longer needed in this file)

Kept:
- `run()` with `loadModule` and `resolveFrame` — still needed for hydration and frame resolution
- The `focusReset: "manual"` listener — still needed for search bar behavior

- [ ] **Step 2: Commit**

```bash
git add app/entry.browser.ts
git commit -m "feat: remove form POST interceptor from client entry"
```

---

## Task 11: Delete RestfulForm and clean up

**Files:**
- Delete: `app/components/RestfulForm.tsx`

- [ ] **Step 1: Delete RestfulForm**

Delete `app/components/RestfulForm.tsx`.

- [ ] **Step 2: Verify no remaining imports of deleted files**

Search for any remaining imports of:
- `RestfulForm`
- `SearchBar` (the standalone one)
- `uploads` controller
- `r2-file-storage`
- `d1-data-table`
- `formData` middleware
- `methodOverride` middleware

If any remain, remove them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete RestfulForm and verify clean imports"
```

---

## Task 12: Format, lint, and verify

- [ ] **Step 1: Run format and lint**

```bash
vp fmt
vp lint
```

Fix any issues that arise.

- [ ] **Step 2: Run typecheck**

```bash
vp check
```

Fix any type errors. Common ones to expect:
- `Id<"contacts">` vs `string` mismatches — use `as any` for Convex ID casts at the boundary
- Missing imports or stale references to deleted files
- The `Contact` type changes (now has `avatarUrl` instead of `avatar` as string)

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "chore: fix lint and type errors from Convex migration"
```
