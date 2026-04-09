# Convex Migration Design

Migrate the contacts app from D1/R2 to Convex as the sole data layer. Move mutations client-side, add real-time subscriptions, replace R2 file storage with Convex file storage, and simplify server routing and frame logic.

## Architecture Overview

The app transitions from a server-centric model (server queries D1, renders HTML, handles mutations via form POSTs) to a Convex-native model:

- **Server** renders the initial full-page HTML using `ConvexHttpClient` for SSR data
- **Client** hydrates interactive components, which subscribe to Convex for real-time updates
- **Mutations** happen client-side via `ConvexClient` (browser), not server round-trips
- **Detail pane** still uses frame navigation for show/edit transitions
- **Sidebar** is a `clientEntry` — server-rendered on first paint, then self-updating via subscription

## Sidebar: Reactive Client Entry

### Current behavior

`Document.tsx` renders `<Frame name="sidebar" url={url} />`. The server resolves this frame by calling the home route with `x-remix-target: sidebar`, which queries contacts and renders `<nav>` with `SidebarItem` components. Search triggers a frame-targeted navigation to `/?q=...`.

### New behavior

The sidebar frame is removed from `Document.tsx`. Instead, the server queries contacts directly and renders a new `SidebarList` client entry inline with initial data as props:

```tsx
// Document.tsx (server)
let contacts = await getContacts(q);

// In render:
<SidebarList contacts={contacts} query={q} />;
```

`SidebarList` is a `clientEntry` that:

1. Renders the contact list from props on first paint (SSR)
2. After hydration, subscribes to `api.contacts.list` via `client.onUpdate()`
3. Filters contacts client-side using `matchSorter` when the user types in the search bar
4. Updates the URL `?q=` param (via `navigate()` with `{ history: "replace" }`) so page refresh preserves the search — but does NOT trigger a frame/server navigation for search

### SearchBar changes

`SearchBar` no longer triggers frame-targeted sidebar navigations. Instead, it updates a shared search state that `SidebarList` reads. The simplest approach: `SearchBar` updates the URL `?q=` param and dispatches an event or calls a callback; `SidebarList` reacts by filtering its subscribed data.

Alternatively, `SearchBar` and the contact list can be part of the same `SidebarList` client entry, since they're tightly coupled. This avoids cross-component coordination. The search input filters the subscribed contact list locally.

### SidebarItem changes

`SidebarItem` continues as a `clientEntry` for active/pending state tracking. Its `contact` prop type changes from `{ id: number, ... }` to use Convex `Id<"contacts">` for the ID field.

## Detail Pane: Frames Stay

### Show route

Clicking a contact navigates via `<a>` with `link({ target: "detail" })`. The server renders `ShowContact` as a frame response. `ShowContact` hydrates and subscribes to `api.contacts.get` — this is already working.

### Edit route

Clicking "Edit" navigates via frame to `/contacts/:id/edit`. The server renders `EditContact` as a frame response. `EditContact` becomes a `clientEntry` so it can handle form submission client-side (calling Convex mutations directly, including file upload).

### Frame simplification

- `Frame.Name` becomes just `"detail"` — remove `"sidebar"` variant
- `contactPage()` helper no longer needs the `target.is("sidebar")` branch
- The home route no longer needs the `target.is("sidebar")` branch

## Mutations: All Client-Side

### Create

The "New" button in `Document.tsx` changes from a `<form method="POST" action="/contacts">` to a `clientEntry` button with an `on("click")` handler that:

1. Calls `client.mutation(api.contacts.create, { first: "", last: "", bsky: "" })`
2. Navigates to `/contacts/:id/edit` with the returned ID

Remove the `create` action from the contacts controller and the `create` route.

### Delete

`DeleteButton` changes from `mutate()` to a direct `on("submit")` handler that:

1. Confirms deletion with the user
2. Calls `client.mutation(api.contacts.remove, { id })`
3. Navigates to `/` (home)

This replaces the current `mutate()` usage because delete needs post-mutation navigation.

Remove the `destroy` action from the contacts controller and the `destroy` route.

### Favorite

`Favorite` switches from fetch-based optimistic UI to `mutate()` with `api.contacts.toggleFavorite`. Since `ShowContact` already subscribes to `api.contacts.get`, the UI updates automatically when the mutation completes. Optimistic updates can be added via the `options.optimisticUpdate` param on `mutate()`.

Remove the `favorite` action from the contacts controller and the `favorite` route.

### Update (with file upload)

`EditContact` becomes a `clientEntry` that handles form submission client-side:

1. On submit, intercept the form
2. If a new avatar file is selected:
   a. Call `api.files.generateUploadUrl` mutation to get an upload URL
   b. `fetch(uploadUrl, { method: "POST", body: file })` to upload the file
   c. Extract the storage ID from the response
   d. Call `api.contacts.update` with the storage ID as the avatar field
3. If no new file, call `api.contacts.update` with existing avatar value
4. Navigate to `/contacts/:id` (show page)

This doesn't fit the simple `mutate()` mixin pattern due to the multi-step upload, but uses a similar `on("submit")` handler.

Remove the `update` action from the contacts controller and the `update` route.

## File Storage: Convex Native

### Schema changes

The `avatar` field in the Convex contacts schema changes from `v.optional(v.string())` to `v.optional(v.id("_storage"))`. Convex provides serving URLs for storage IDs automatically.

### New Convex functions

- `generateUploadUrl` — mutation that calls `ctx.storage.generateUploadUrl()`
- Update the `get` query (and `list` if needed) to resolve storage IDs to serving URLs via `ctx.storage.getUrl()`

### Removals

- `app/controllers/uploads.ts` — entire file
- `app/data/adapters/r2-file-storage.ts` — entire file
- `/uploads/*key` route from `routes.ts`
- R2-related configuration from `wrangler.jsonc`
- `formData({ uploadHandler })` middleware — the upload handler is no longer needed since file uploads go directly to Convex from the client. The `formData()` middleware itself may still be needed if any server-side form parsing remains, or can be removed if all mutations are client-side.

## Server Routes: Simplified

### Routes that remain

```ts
export let routes = route({
    home: get("/"),
    contacts: {
        show: get("/contacts/:id"),
        edit: get("/contacts/:id/edit"),
    },
});
```

All mutation routes (`create`, `destroy`, `favorite`, `update`) are removed. The `uploads` route is removed. The `resources()` helper is replaced with explicit `get()` routes since we only need the read endpoints.

### Home route

Renders the full document on initial load. No longer needs frame target handling for sidebar — just renders the document with inline sidebar data.

If the detail frame target is requested, return a frame response for the detail pane (e.g., `ZeroState`).

### Contacts controller

Simplifies to just `show` and `edit` — both GET-only. Each action must handle two cases: a frame-targeted request (return a frame response for the detail pane) and a direct browser request (return the full document):

```ts
export default {
    actions: {
        async show(ctx) {
            let target = ctx.get(Frame.Target);
            if (target.is("detail")) {
                let { q } = s.parse(QuerySchema, ctx.url.searchParams);
                let contact = await getContact(ctx.params.id);
                if (!contact) return redirect(routes.home.href());
                return frame(<ShowContact initial={contact} query={q} />);
            }
            return document();
        },
        async edit(ctx) {
            let target = ctx.get(Frame.Target);
            if (target.is("detail")) {
                let contact = await getContact(ctx.params.id);
                if (!contact) return redirect(routes.home.href());
                return frame(<EditContact contact={contact} />);
            }
            return document();
        },
    },
};
```

Remove `contactPage()` — the two remaining actions are simple enough to inline. The sidebar branch is gone and the full-document case is a direct `document()` call.

### Middleware simplification

```ts
middleware: [
    staticFiles("./public"),
    staticFiles("./dist/client"),
    asyncContext(),
    loadConvex(),
    frameTarget(),
];
```

Removed: `formData({ uploadHandler })` (no server-side form parsing needed), `methodOverride()` (no PUT/PATCH/DELETE to the server).

## Entry Points

### Server entry (`entry.server.tsx`)

Simplified middleware stack and route map. The router handles fewer routes.

### Client entry (`entry.browser.ts`)

The form POST interceptor in the `navigation` event listener can be simplified or removed — mutations no longer go through form POSTs to the server. GET form submissions (if any remain) and `<a>` navigations still need the frame resolution logic.

## Data Layer Changes

### `app/data/contacts.ts`

The server-side data functions (`getContacts`, `getContact`) remain for SSR — they use `ConvexHttpClient` from async context. But `createContact`, `updateContact`, `deleteContact` are removed since mutations happen client-side now.

The `fakeNetwork` delay function is removed — Convex has its own latency characteristics.

### `app/data/schemas.ts`

- `UpdateSchema`, `FavoriteSchema`, `DeleteSchema` — may still be used by `mutate()` mixin for form data parsing. Review which are still needed.
- `QuerySchema` — still needed for server-side `?q=` parsing on initial load.
- `IdSchema` — still needed for route param parsing.

### `app/utils/convex.tsx`

The `mutate()` mixin and its `ConvexClient` instance remain as the primary client-side mutation mechanism. May need extension for the file upload flow.

## Component Summary

| Component      | Current                                  | New                                                               |
| -------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `Document`     | Server component, renders sidebar frame  | Server component, renders `SidebarList` inline with data          |
| `SidebarList`  | Does not exist (sidebar is frame)        | New `clientEntry`, subscribes to `api.contacts.list`              |
| `SidebarItem`  | `clientEntry`, tracks active/pending     | Same, but ID type changes to Convex `Id<"contacts">`              |
| `SearchBar`    | `clientEntry`, triggers frame navigation | Merged into `SidebarList`                                         |
| `ShowContact`  | `clientEntry`, subscribes to Convex      | Same, already working                                             |
| `EditContact`  | Server component, form POSTs to server   | `clientEntry`, handles mutation + file upload client-side         |
| `Favorite`     | `clientEntry`, fetch-based optimistic UI | `clientEntry`, uses `mutate()` with `api.contacts.toggleFavorite` |
| `DeleteButton` | `clientEntry`, uses `mutate()`           | `clientEntry`, direct `on("submit")` handler with navigation      |
| `CancelButton` | `clientEntry`                            | Same                                                              |
| `NewButton`    | Server-rendered form POST                | New `clientEntry`, calls create mutation + navigates              |
| `RestfulForm`  | Method override wrapper                  | Removed — no more PUT/PATCH/DELETE to server                      |
| `Title`        | Server component                         | Same                                                              |
| `ZeroState`    | Server component                         | Same                                                              |

## Removals

### Files to delete

- `app/controllers/uploads.ts`
- `app/data/adapters/r2-file-storage.ts`
- `app/data/adapters/d1-data-table.ts` (legacy, already unused)
- `app/components/RestfulForm.tsx` (no more method override needed)
- `db/` directory (D1 migrations, already deleted on this branch)
- `app/middleware/database.ts` (already deleted on this branch)
- `app/middleware/file-storage.ts` (already deleted on this branch)

### Code to remove

- `formData()` and `methodOverride()` from middleware stack
- `create`, `destroy`, `favorite`, `update` actions from contacts controller
- `createContact`, `updateContact`, `deleteContact` from `app/data/contacts.ts`
- `fakeNetwork` from `app/data/contacts.ts`
- `/uploads/*key` route
- Mutation routes from `resources()` call
- `Frame.Name` `"sidebar"` variant
- `sidebar()` function from `app/utils/render.tsx`
- Form POST interceptor from `entry.browser.ts` (if no server forms remain)

### Config to clean up

- Remove R2 bucket binding from `wrangler.jsonc` (keep wrangler itself — the SSR server deploys to Workers)
- Remove D1 database binding from `wrangler.jsonc` if still present

## Design Decisions

1. **SearchBar merges into SidebarList.** They share search state and the contact list — keeping them separate forces cross-component coordination with no benefit. The combined component is still small.
2. **Convex queries resolve storage IDs to URLs server-side.** The `get` and `list` queries call `ctx.storage.getUrl()` and return the serving URL as a string alongside the contact data. This keeps SSR simple — components just render the URL string, no client-side resolution needed.
3. **Navigation after client mutations uses `on("submit")` handlers, not the `mutate()` mixin.** For create, delete, and update, the component needs to navigate after the mutation completes. These use direct `client.mutation()` calls inside `on("submit")` handlers followed by `navigate()`. The `mutate()` mixin is best for fire-and-forget mutations like `toggleFavorite` where the subscription handles the UI update.
4. **Remove `contactPage()` helper.** With only show and edit remaining, each action is a few lines — a shared helper adds indirection without reducing code.
