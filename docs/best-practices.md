# Remix 3 + Vite+ Best Practices Cookbook

A decision-oriented guide for building Remix 3 applications. Each recipe is self-contained: find the decision you're facing, read the heuristic, follow the pattern. This supplements the official API docs in `docs/remix-official/` with practical wisdom that isn't obvious from reading API surfaces alone.

## Project Structure

A typical Remix 3 + Vite+ project:

```
app/
  entry.server.tsx    # Server entry: router, middleware stack, route mapping
  entry.browser.ts    # Client entry: run(), navigation interception
  routes.ts           # Route definitions (single source of truth for URLs)
  index.css           # Global styles
  controllers/        # Route handlers (one file per resource/domain)
  components/         # UI components (server-only and hydrated)
  lib/
    schemas.ts        # Data validation schemas
    render.tsx        # Server rendering utilities (document, frame helpers)
    navigating.ts     # Client navigation state tracking
    database/         # Database layer (middleware, queries, seed data)
vite.config.ts        # Unified config: build, dev, fmt, lint, typecheck
remix.plugin.ts       # Vite plugin for Remix (build, SSR, client entries)
```

**Key principle:** Everything runs through `vite.config.ts`. There are no separate config files for linting, formatting, or building. The CLI is `vp` (Vite+).

For small apps with one or two resources, a controller can live at the top level of `app/` (e.g. `app/posts.tsx`). Once you have several, move them into `app/controllers/` to keep things organized.

---

## Recipes

### 1. Should I hydrate this component?

**Decision:** Does this component need to respond to user interaction on the client?

**Heuristic:** Default to server-only. Only wrap a component with `clientEntry` when it needs one of these:
- Event handlers (`on("click")`, `on("submit")`, `on("input")`)
- Local state that changes without a full page navigation
- Access to browser APIs (`window`, `navigation`, `localStorage`)
- Optimistic updates or loading states

**Server-only component** (no hydration, zero client JS):

```tsx
export function UserProfile() {
    return (props: { user: User }) => (
        <div>
            <h1>{props.user.name}</h1>
            <p>{props.user.bio}</p>
        </div>
    );
}
```

**Hydrated component** (ships JS to client):

```tsx
export const LikeButton = clientEntry(import.meta.url, (handle: Handle) => {
    let submitting = false;
    let liked!: boolean;

    return (props: { itemId: number; liked: boolean }) => {
        if (!submitting) liked = props.liked;
        return (
            <form mix={on("submit", async event => { /* client logic */ })}>
                {/* ... */}
            </form>
        );
    };
});
```

**The pattern:** `clientEntry(import.meta.url, setupFn)` where `setupFn` receives a `Handle` and returns the render function. The setup function runs once on hydration; the render function runs on every update.

**What goes in setup vs. render:**
- **Setup:** Event listener registration (`addEventListeners`), one-time initialization, state variable declarations, anything that should survive re-renders
- **Render:** JSX, derived values, conditional logic based on current props/state

**Important:** All props passed to a `clientEntry` component must be serializable (strings, numbers, booleans, plain objects, arrays). The server serializes them as JSON for the client to hydrate. You cannot pass functions, class instances, or DOM nodes as props to hydrated components.

---

### 2. How should I handle form submissions?

**Decision:** Should this form use standard HTML submission, fetch-based submission, or client-side navigation?

**Heuristic:** Start with a plain HTML `<form>` that works without JavaScript. Then layer on client-side enhancement only if you need one of:
- Optimistic updates (show result before server responds)
- Preventing full-page navigation (update only a specific frame)
- Confirmation dialogs before submission
- Custom redirect behavior

**Level 1 - Plain HTML form (no JS required):**

```tsx
export function CreateButton() {
    return () => (
        <form action={routes.items.create.href()} method="POST">
            <button type="submit">New</button>
        </form>
    );
}
```

This works with JavaScript disabled. The browser POSTs, the server handles the action, returns a redirect, and the browser follows it.

**Level 2 - Enhanced with `navigate()` (frame-targeted):**

```tsx
export const EditButton = clientEntry(import.meta.url, () => {
    return (props: { itemId: number }) => (
        <form
            action={routes.items.edit.href({ id: props.itemId })}
            method="GET"
            mix={on("submit", event => {
                event.preventDefault();
                navigate(event.currentTarget.action, { target: "content" });
            })}
        >
            <button type="submit">Edit</button>
        </form>
    );
});
```

The `target: "content"` tells the navigation system to only update the named frame, leaving the rest of the page untouched.

**Level 3 - Fetch-based submission (optimistic UI, custom flow):**

```tsx
mix={on("submit", async event => {
    event.preventDefault();
    if (!confirm("Delete this record?")) return;

    const response = await fetch(event.currentTarget.action, {
        method: "POST",
        body: new FormData(event.currentTarget, event.submitter),
    });
    navigate(response.url);
})}
```

Use this when you need to intercept the response (e.g., follow the redirect URL yourself) or add pre-submission logic like confirmation dialogs.

**Method override for PUT/PATCH/DELETE:** HTML forms only support GET and POST. For other HTTP methods, use a hidden `_method` field with the `methodOverride()` middleware:

```tsx
<form action={route.href({ id })} method="POST">
    <input name="_method" type="hidden" value="DELETE" />
    <button type="submit">Delete</button>
</form>
```

The `methodOverride()` middleware in your server entry reads `_method` from the form data and rewrites the request method before it reaches your controller.

---

### 3. How do I implement optimistic updates?

**Decision:** Should I update the UI before the server responds?

**Heuristic:** Use optimistic updates for toggle-like actions where:
- The expected outcome is predictable (toggling a boolean, incrementing a count)
- The action is unlikely to fail
- Instant feedback significantly improves perceived performance

**The pattern:**

1. Keep local state in the setup scope (survives re-renders)
2. On submit: update local state immediately, call `handle.update()` to re-render
3. Fire the fetch request
4. On success: trigger a soft navigation to sync server state
5. On failure: revert local state, call `handle.update()` again

```tsx
export const LikeButton = clientEntry(import.meta.url, (handle: Handle) => {
    let submitting = false;
    let liked!: boolean;

    return (props: { itemId: number; liked: boolean }) => {
        // Accept server value only when not mid-submission
        if (!submitting) liked = props.liked;

        return (
            <form mix={on("submit", async event => {
                event.preventDefault();

                // 1. Optimistic update
                liked = !liked;
                submitting = true;
                const signal = await handle.update();

                try {
                    // 2. Send to server
                    const response = await fetch(event.currentTarget.action, {
                        method: event.currentTarget.method,
                        body: new FormData(event.currentTarget, event.submitter),
                        signal,
                    });
                    if (!response.ok && !response.redirected) throw response;

                    // 3. Sync with server state
                    submitting = false;
                    navigate(window.location.href, { history: "replace" });
                } catch {
                    // 4. Rollback on failure
                    liked = !liked;
                    submitting = false;
                    handle.update();
                }
            })}>
                <button name="liked" type="submit" value={String(liked)}>
                    {liked ? "\u2665" : "\u2661"}
                </button>
            </form>
        );
    };
});
```

**Key details:**
- `handle.update()` returns an `AbortSignal` you can pass to `fetch` -- if the component unmounts or re-renders before the fetch completes, it's automatically cancelled
- The `submitting` flag prevents the server-provided prop from overwriting the optimistic value during re-renders
- `navigate(window.location.href, { history: "replace" })` triggers a soft reload that syncs all frames with the latest server state without adding a history entry

---

### 4. How do I build search-as-you-type?

**Decision:** How should search interact with the URL, history, and frame system?

**Heuristic:** Search should always be URL-driven (the query lives in a search param like `?q=`). This makes search results linkable, back-button friendly, and server-renderable.

**The pattern:**

```tsx
export const SearchInput = clientEntry(import.meta.url, (handle: Handle) => {
    // Re-render when navigation state changes (for loading indicator)
    addEventListeners(navigating, handle.signal, {
        destinationchange() { handle.update(); },
    });

    return (props: { query?: string }) => {
        const searching = Boolean(navigating.to.url?.searchParams.has("q"));

        return (
            <form method="GET">
                <input
                    defaultValue={props.query ?? undefined}
                    mix={on("input", async event => {
                        const url = new URL(location.href);

                        if (!event.currentTarget.value.trim()) {
                            url.searchParams.delete("q");
                        } else {
                            url.searchParams.set("q", event.currentTarget.value);
                        }

                        const isFirstSearch =
                            new URL(location.href).searchParams.get("q") === null;

                        navigate(url.toString(), {
                            target: "results",
                            history: isFirstSearch ? "replace" : "push",
                        });
                    })}
                    name="q"
                    type="search"
                />
                <div aria-hidden hidden={!searching} class="spinner" />
            </form>
        );
    };
});
```

**Why `replace` for the first search, `push` after:** When the user starts typing, the first keystroke replaces the current history entry (so pressing back doesn't step through "s", "sa", "sam" one character at a time). Subsequent keystrokes push new entries so the user can still navigate between meaningful search states.

**Why use a `target`:** If your search results live in a specific frame, targeting that frame keeps the rest of the page stable during search. If your app doesn't use frames, omit the `target` option.

**Loading state:** The `navigating` singleton tracks pending navigation state. When a navigation is in flight with a `q` param, show a spinner. The `destinationchange` event fires when navigation starts and completes, triggering re-renders.

---

### 5. How do frames work and when should I use them?

**Decision:** Should I use frames to split my page into independently-updatable regions?

**Heuristic:** Use frames when your page has regions that:
- Update independently (e.g., a navigation list and a content area)
- Have different data requirements
- Should be navigable without reloading the entire page

Not every app needs frames. A simple single-column page that always renders as a whole doesn't benefit from them. Frames shine in layouts with two or more regions that change at different times.

**Defining frames in your document:**

```tsx
export function Document() {
    return () => (
        <html>
            <body>
                <nav>
                    <Frame name="nav" src={url.toString()} />
                </nav>
                <main>
                    <Frame name="content" src={url.toString()} />
                </main>
            </body>
        </html>
    );
}
```

Each `<Frame>` is a named region. The `src` tells the server where to fetch the initial content. On the server, `resolveFrame` is called during `renderToStream` to load frame content inline. On the client, frames are fetched via the `resolveFrame` callback in `run()`.

**Targeting frames from navigation:**

```tsx
// From JavaScript:
navigate(url, { target: "content" });

// From HTML (no JS required):
<a href={url} rmx-target="content">Click me</a>
```

**Server-side frame detection:** The server knows which frame is being requested via the `x-remix-target` header. Your controller checks this to decide what to render:

```tsx
const target = request.headers.get("x-remix-target");

if (target === "nav") return frame(<NavList items={items} />);
if (target === "content") return frame(<ItemDetail item={item} />);
return document(); // Full page (initial load, hard refresh, no JS)
```

**The two fundamental response types:**
- `document()` - Full HTML page with `<html>`, `<head>`, `<body>`. Used for initial page loads and no-JS fallback.
- `frame(node)` - An HTML fragment for a specific frame region. Used when a named frame is targeted.

You'll typically build helper functions on top of these for your app's specific layout patterns (e.g., a helper that renders a nav frame with the current item highlighted, or a content frame with common wrappers).

**Frame resolution on the server:** When rendering a full document, nested `<Frame>` components need their content resolved. The `resolveFrame` callback in `renderToStream` handles this by internally routing the frame's `src` through the router:

```tsx
renderToStream(<Document />, {
    frameSrc: context.url,
    async resolveFrame(src, target, ctx) {
        const url = new URL(src, ctx?.currentFrameSrc ?? context.url);
        const headers = new Headers({ accept: "text/html" });
        if (target) headers.set("x-remix-target", target);
        return (await router.fetch(new Request(url, { headers }))).body;
    },
});
```

---

### 6. How do I set up routing?

**Decision:** How should I define my app's URL structure?

**Heuristic:** Define all routes in a single `routes.ts` file. Use the `route()` helper for type-safe, centralized route definitions. Never hardcode URL strings in components or controllers.

**Basic route definition:**

```tsx
import { route, resources } from "remix/fetch-router/routes";

export const routes = route({
    home: "/",
    posts: {
        ...resources("/posts"),
        publish: { method: "POST", pattern: "/posts/:id/publish" },
    },
    settings: "/settings",
});
```

**What `resources()` generates:** RESTful route patterns following REST conventions. `resources("/posts")` creates routes for `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy`. Use `exclude` to omit routes you don't need:

```tsx
resources("/posts", { exclude: ["index", "new"] })
```

**Custom routes:** Add any custom route as an object with `method` and `pattern`. Parameters use `:name` syntax.

**Using routes in components (type-safe URL generation):**

```tsx
routes.posts.show.href({ id: 42 })              // "/posts/42"
routes.posts.edit.href({ id: 42 }, { tab: "meta" })  // "/posts/42/edit?tab=meta"
routes.home.href()                               // "/"
```

**Mapping routes to controllers in the server entry:**

```tsx
router.map(routes.home, async () => { /* ... */ });
router.map(routes.posts, postsController);  // Maps all sub-routes to a controller
```

---

### 7. How do I structure my server entry?

**Decision:** What middleware do I need and in what order?

**Heuristic:** Middleware runs in order for every request. Put cheap/broad middleware first, expensive/specific middleware last.

**Recommended middleware stack:**

```tsx
export const router = createRouter({
    middleware: [
        staticFiles("./public"),          // 1. Serve static files (short-circuits)
        staticFiles("./dist/client"),     // 2. Serve built client assets
        formData(),                       // 3. Parse multipart/urlencoded form data
        methodOverride(),                 // 4. Rewrite _method field to real HTTP method
        asyncContext(),                   // 5. Enable request-scoped context (getContext())
        await loadDatabase(),             // 6. Initialize database, inject into context
    ],
});
```

**Why this order matters:**
1. **Static files first:** Most requests for CSS/JS/images should return immediately without touching form parsing or database setup.
2. **Form data before method override:** `methodOverride()` reads from the parsed form data, so `formData()` must run first.
3. **Async context before database:** The database middleware uses `context.set()` which requires async context to be active.

**HMR support:** Add this at the bottom of your server entry so the dev server picks up changes:

```tsx
if (import.meta.hot) {
    import.meta.hot.accept();
}
```

---

### 8. Where does my logic belong?

**Decision:** Should this code be in a controller, middleware, component, or utility?

**Heuristic:**

| Logic type | Where it goes | Why |
|---|---|---|
| Request handling for a specific route | **Controller** (`controllers/`) | Tied to a route's URL/method |
| Cross-cutting concern (auth, logging, parsing) | **Middleware** (`lib/`) | Runs across many routes |
| UI rendering | **Component** (`components/`) | Presentation layer |
| Data access / business rules | **Lib utilities** (`lib/`) | Reusable, testable |
| Validation schemas | **`lib/schemas.ts`** | Shared between controllers |
| Rendering helpers (document, frame) | **`lib/render.tsx`** | Shared rendering logic |

**Controllers** are objects that satisfy the `Controller` type. They map route actions to handler functions:

```tsx
export default {
    actions: {
        async index(context) { /* ... */ },
        async show(context) { /* ... */ },
        async create(context) { /* ... */ },
        async update(context) { /* ... */ },
        async destroy(context) { /* ... */ },
    },
} satisfies Controller<typeof routes.posts>;
```

The `satisfies Controller<typeof routes.posts>` ensures your action names match the route definitions. Each action receives the request context with typed `params` based on the route pattern.

**Middleware** is a function that receives `(context, next)` and returns a `Response`:

```tsx
async (context, next) => {
    context.set(Database, db);
    return next();
}
```

Call `next()` to pass through to the next middleware or the matched route handler. You can modify the context before calling `next()` or modify the response after.

---

### 9. How do I validate form data and search params?

**Decision:** How should I parse and validate incoming data?

**Heuristic:** Always validate at the boundary (where external data enters your system). Use `remix/data-schema` for type-safe parsing that handles coercion from form data strings to proper types.

**Defining schemas:**

```tsx
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

// Search params: optional string
const SearchSchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

// Form data with coercion: string "true"/"false" -> boolean
const ToggleSchema = f.object({
    enabled: f.field(coerce.boolean()),
});

// Form data with defaults: missing fields become empty strings
const ProfileSchema = f.object({
    name: f.field(s.defaulted(s.string(), "")),
    email: f.field(s.defaulted(s.string(), "")),
    bio: f.field(s.defaulted(s.string(), "")),
});
```

**Parsing in controllers:**

```tsx
// Parse search params (URLSearchParams)
const { q } = s.parse(SearchSchema, context.url.searchParams);

// Parse form data (FormData from request body)
const { enabled } = s.parse(ToggleSchema, context.get(FormData));
const profile = s.parse(ProfileSchema, context.get(FormData));
```

**Key concepts:**
- `f.object()` / `f.field()` handle FormData extraction (fields are always strings in the raw form)
- `coerce.boolean()` converts string `"true"`/`"false"` to actual booleans
- `s.defaulted()` provides fallback values for missing fields
- `s.union()` allows multiple types (e.g., string or undefined for optional params)
- `s.parse()` throws on validation failure -- you get typed data or an error, never silently wrong types

---

### 10. How do I show loading and pending states?

**Decision:** How do I indicate that something is loading or in-progress?

**Heuristic:** Use the `Navigating` class to track navigation state. Derive loading/pending states from the destination URL rather than managing boolean flags.

**Setting up the navigation tracker:**

The `Navigating` class wraps the browser's Navigation API and emits `destinationchange` events:

```tsx
// lib/navigating.ts - a singleton
export const navigating = new Navigating();
```

It exposes:
- `navigating.to.state` - `"idle"`, `"loading"`, or `"submitting"`
- `navigating.to.url` - the destination URL (or `undefined` when idle)
- `navigating.to.formData` - form data if submitting (or `undefined`)

**Listening for navigation changes in a component:**

```tsx
export const MyComponent = clientEntry(import.meta.url, (handle: Handle) => {
    addEventListeners(navigating, handle.signal, {
        destinationchange() { handle.update(); },
    });

    return () => {
        const isLoading = navigating.to.state === "loading";
        return <div class={isLoading ? "loading" : ""}>...</div>;
    };
});
```

**Deriving pending state for specific items** (e.g., which list item is about to become active):

```tsx
const destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
const isPending = Number(destination?.params.id) === item.id;
```

This avoids managing per-item loading state. The navigation destination tells you which item is being navigated to.

**Server safety:** `Navigating` is safe to instantiate on the server -- it skips event listener registration when `typeof window === "undefined"`. Components can reference `navigating` without conditional imports, but should guard client-only logic with `isServer` checks.

---

### 11. How does SPA navigation work with frames?

**Decision:** How do I set up client-side navigation that works with the frame system?

**Heuristic:** The client entry (`entry.browser.ts`) sets up two things: the Remix runtime via `run()`, and navigation interception via the Navigation API. Both are required for SPA-like behavior.

**Client entry setup:**

```tsx
run({
    async loadModule(moduleUrl, exportName) {
        const mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    async resolveFrame(src, signal, target) {
        const headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        const response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    },
});
```

- `loadModule` tells the runtime how to dynamically import hydrated components
- `resolveFrame` tells the runtime how to fetch frame content (with the right headers so the server knows it's a frame request)

**Navigation interception:**

```tsx
navigation.addEventListener("navigate", event => {
    if (!event.canIntercept) return;

    if (event.formData) {
        // Form submissions: POST via fetch, navigate to redirect URL
        event.intercept({
            focusReset: "manual",
            async handler() {
                const response = await fetch(event.destination.url, {
                    method: "POST", body: event.formData, signal: event.signal,
                });
                navigate(response.url);
            },
        });
        return;
    }

    // GET navigations: just prevent browser focus reset
    if (event.navigationType !== "traverse") {
        event.intercept({ focusReset: "manual" });
    }
});
```

**Why `focusReset: "manual"`:** The browser's default behavior resets focus to the top of the page on navigation. Since frame updates only change part of the page, you want to manage focus yourself.

**Why traverse navigations are left alone:** Back/forward navigations are handled by the built-in Remix listener. Intercepting them again would conflict.

---

### 12. How should I manage history (push vs. replace)?

**Decision:** When should a navigation create a new history entry vs. replace the current one?

**Heuristic:**

| Scenario | History mode | Why |
|---|---|---|
| User clicks a link to a new page | **push** (default) | Back button should return to previous page |
| Search-as-you-type (after first keystroke) | **push** | Back button navigates between search states |
| First search keystroke | **replace** | Don't create an entry for the pre-search state with `?q=` |
| Optimistic update sync (`navigate(location.href)`) | **replace** | Syncing server state shouldn't create history |
| Removing a query param (clearing search) | **push** or **replace** | Depends on whether "cleared search" is a meaningful state |

```tsx
// Push (new history entry)
navigate(url);

// Replace (overwrite current entry)
navigate(url, { history: "replace" });
```

---

### 13. How do I set up request-scoped data?

**Decision:** How do I make data (database connections, user sessions, etc.) available throughout a request?

**Heuristic:** Use context keys and middleware injection. Context keys are type-safe tokens that middleware `set()`s and handlers `get()`.

**Define a context key:**

```tsx
import { createContextKey } from "remix/fetch-router";
export const Database = createContextKey<DataTable>();
```

**Set it in middleware:**

```tsx
export async function loadDatabase(): Promise<Middleware> {
    const db = createDatabase(sqliteAdapter(new SQLite(":memory:")));
    // ... setup (create tables, seed, etc.) ...

    return async (context, next) => {
        context.set(Database, db);
        return next();
    };
}
```

**Read it in controllers or utilities:**

```tsx
// In a controller action:
const db = context.get(Database);

// In a utility function (via async context):
import { getContext } from "remix/async-context-middleware";
const db = getContext().get(Database);
```

The `asyncContext()` middleware makes the request context available anywhere via `getContext()` without threading it through function arguments. This is especially useful in data access functions that are called from controllers but don't directly receive the request context.

---

### 14. How do I compose the component factory pattern?

**Decision:** Why do components return functions, and how does this affect composition?

**Heuristic:** Every Remix 3 component is a factory -- a function that returns a render function. The outer function is the "setup" phase (runs once); the inner function is the "render" phase (runs on every update).

**Server-only component:**

```tsx
export function UserCard() {
    // Setup: runs once per render on the server
    return (props: { user: User }) => (
        // Render: the actual JSX
        <div>{props.user.name}</div>
    );
}
```

For server-only components, the setup phase is minimal -- there's no persistent state. But the factory pattern is still required.

**Hydrated component:**

```tsx
export const SearchInput = clientEntry(import.meta.url, (handle: Handle) => {
    // Setup: runs once on hydration
    addEventListeners(navigating, handle.signal, {
        destinationchange() { handle.update(); },
    });

    return (props: { query?: string }) => {
        // Render: runs on every update
        const searching = Boolean(navigating.to.url?.searchParams.has("q"));
        return <input defaultValue={props.query} />;
    };
});
```

**Composing components:** Use standard JSX composition. Server-only components can contain hydrated components (creating islands of interactivity):

```tsx
export function ItemDetail() {
    return (props: { item: Item }) => (
        <div>
            <h1>{props.item.title}</h1>
            {/* LikeButton is hydrated; ItemDetail is not */}
            <LikeButton itemId={props.item.id} liked={props.item.liked} />
        </div>
    );
}
```

This is the islands architecture pattern: the server renders the full page, but only the interactive pieces ship JavaScript to the client. The surrounding server-only markup is static HTML with zero runtime cost.

---

### 15. How do I use `rmx-target` for frame-targeted links?

**Decision:** How do I make a plain `<a>` tag navigate within a specific frame?

**Heuristic:** Use the `rmx-target` attribute on links to target a named frame without any JavaScript:

```tsx
<a href={routes.posts.show.href({ id: post.id })} rmx-target="content">
    {post.title}
</a>
```

When the Remix client runtime intercepts this navigation, it reads the `rmx-target` attribute and passes it as the `target` parameter to `resolveFrame`. The server receives it as the `x-remix-target` header.

This is the declarative equivalent of:

```tsx
navigate(url, { target: "content" });
```

**Use `rmx-target` for links and `navigate()` with `target` for programmatic navigation.** They work identically under the hood.

---

### 16. How do I handle the full-page vs. frame response decision?

**Decision:** My controller handles the same route for initial loads and frame updates. How do I return the right response?

**Heuristic:** Check the `x-remix-target` header to determine which frame (if any) is being requested. Each controller action should handle both full-page and frame-targeted requests.

```tsx
async function renderPage(context, contentRenderer) {
    const target = getContext().request.headers.get("x-remix-target");

    // A specific frame was targeted -- return just that frame's content
    if (target === "nav") {
        return frame(<NavList items={await getItems()} />);
    }
    if (target === "content") {
        return frame(contentRenderer());
    }

    // No target -- full page load (initial navigation, hard refresh, no JS)
    return document();
}
```

**Why this pattern matters:** The same URL serves different content depending on context:
- **Initial page load:** Returns a full HTML document with all frames resolved inline
- **Frame navigation:** Returns just the targeted frame's HTML fragment
- **No JavaScript:** Falls back to full document -- progressive enhancement still works

**Extract this into a reusable helper** when multiple routes share the same layout. Each app will have its own set of frame names and rendering helpers based on its layout structure.

---

### 17. How should I define database tables and queries?

**Decision:** How do I set up typed database access with `remix/data-table`?

**Heuristic:** Define table schemas using `column` and `table`, derive TypeScript types with `TableRow`, and access the database through the request context.

**Table definition:**

```tsx
import { column as c, table, type TableRow } from "remix/data-table";

export const Posts = table({
    name: "posts",
    columns: {
        id: c.integer().primaryKey(),
        title: c.text().notNull(),
        body: c.text().notNull(),
        published: c.boolean().default(false),
        createdAt: c.integer().notNull(),
    },
});

export type Post = TableRow<typeof Posts>;
```

**Query functions** access the database through context:

```tsx
export async function getPosts(): Promise<Post[]> {
    const db = getContext().get(Database);
    return await db.findMany(Posts);
}
```

**Key pattern:** Data access functions use `getContext()` to get the database rather than accepting it as a parameter. This keeps function signatures clean and works anywhere in the call stack as long as `asyncContext()` middleware is active.

---

### 18. How do I handle redirects after mutations?

**Decision:** What should happen after a create/update/delete?

**Heuristic:** Follow the Post/Redirect/Get pattern. After every mutation, redirect to the appropriate page:

```tsx
// After create: redirect to the edit page for the new record
async create() {
    const id = await createPost();
    return redirect(routes.posts.edit.href({ id }));
}

// After update: redirect to the show page
async update(context) {
    const data = s.parse(PostSchema, context.get(FormData));
    await updatePost(Number(context.params.id), data);
    return redirect(routes.posts.show.href({ id: context.params.id }));
}

// After delete: redirect to the index or home
async destroy(context) {
    await deletePost(Number(context.params.id));
    return redirect(routes.posts.index.href());
}
```

**Why PRG matters:** It prevents duplicate submissions on refresh and ensures the browser's back button works correctly.

**For non-navigating mutations** (like toggling a boolean field), return data instead of redirecting:

```tsx
async toggle(context) {
    const { enabled } = s.parse(ToggleSchema, context.get(FormData));
    const updated = await updateItem(Number(context.params.id), { enabled });
    return Response.json(updated);
}
```

The client handles the state update optimistically and doesn't need a redirect.

---

### 19. How do I configure Vite+ for a Remix project?

**Decision:** What does my `vite.config.ts` need?

**Heuristic:** Keep it minimal. The Remix plugin handles most of the build configuration.

```tsx
import { defineConfig } from "vite-plus";
import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix()],
    server: { port: 3000 },
    css: { transformer: "lightningcss" },
    resolve: { tsconfigPaths: true },
    fmt: { /* Oxfmt options */ },
    lint: { /* Oxlint options */ },
});
```

**What the `remix()` plugin provides:**
- **Build orchestration:** Builds SSR then client environments, with separate output directories (`dist/ssr`, `dist/client`)
- **Preview server:** Loads the built SSR entry and creates a request listener for `vp preview`
- **Client entry transforms:** Automatically resolves `import.meta.url` in `clientEntry()` calls to the correct asset URLs for both server and client environments
- **Error suppression:** Prevents abort errors from cancelled requests (e.g., search-as-you-type) from triggering the Vite error overlay

**Commands:**
- `vp dev` -- start dev server with HMR
- `vp build` -- production build
- `vp preview` -- preview production build locally
- `vp check` -- format + lint + typecheck in one pass

---

### 20. How do I derive active/pending state for navigation items?

**Decision:** How does a list item know if it's currently active or being navigated to?

**Heuristic:** Use route pattern matching against the current URL (for active) and the navigation destination URL (for pending). This is necessary because frame-targeted navigations only update one frame -- components in other frames don't re-render, so server-provided props become stale.

```tsx
import { ArrayMatcher } from "remix/route-pattern";

// Set up a matcher for the routes this item could match
const matcher = new ArrayMatcher<true>();
matcher.add(routes.posts.show.pattern.source, true);
matcher.add(routes.posts.edit.pattern.source, true);

// In the render function:
const currentMatch = !isServer ? matcher.match(window.location.href) : null;
const isActive = Number(currentMatch?.params?.id ?? selected) === item.id;

// Pending: destination matches this item but isn't the current page
const destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
const isPending = !isActive
    && navigating.to.url?.pathname !== window.location.pathname
    && Number(destination?.params.id) === item.id;
```

**Why derive from URL instead of props:** Frame-targeted navigations don't re-render components outside the targeted frame. A server-provided `selected` prop becomes stale after client-side navigation. Reading `window.location.href` directly gives the true current state.

**The `selected` prop serves as a server fallback** for the initial render and non-JS environments. On the client, the URL-derived state takes precedence.
