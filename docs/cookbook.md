# Remix 3 & Vite Best Practices Cookbook

A decision-oriented guide for building Remix 3 applications. Each recipe is self-contained: find the decision you're facing, read the heuristic, follow the pattern. This supplements the official API docs in `docs/remix-official/` with practical wisdom that isn't obvious from reading API surfaces alone.

## Project Structure

A typical Remix 3 & Vite project:

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
export let LikeButton = clientEntry(import.meta.url, (handle: Handle) => {
    let submitting = false;
    let liked!: boolean;

    return (props: { itemId: number; liked: boolean }) => {
        if (!submitting) liked = props.liked;
        return (
            <form
                mix={on("submit", async event => {
                    /* client logic */
                })}
            >
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
export let EditButton = clientEntry(import.meta.url, () => {
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

**Level 3 - Pre-submission guard (confirmation dialog):**

```tsx
mix={on("submit", event => {
    if (!confirm("Delete this record?")) {
        event.preventDefault();
    }
})}
```

Call `event.preventDefault()` to cancel the submission. If not cancelled, the form submits normally -- the client entry's navigate listener handles POSTing via `fetch` and following the redirect. You don't need to manage `fetch` yourself here.

**Level 4 - Fetch-based submission (optimistic UI, custom response handling):**

```tsx
mix={on("submit", async event => {
    event.preventDefault();

    let response = await fetch(event.currentTarget.action, {
        method: "POST",
        body: new FormData(event.currentTarget, event.submitter),
    });
    navigate(response.url);
})}
```

Use this when you need full control over the response (e.g., optimistic UI, reading response data, conditional redirects).

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
export let LikeButton = clientEntry(import.meta.url, (handle: Handle) => {
    let submitting = false;
    let liked!: boolean;

    return (props: { itemId: number; liked: boolean }) => {
        // Accept server value only when not mid-submission
        if (!submitting) liked = props.liked;

        return (
            <form
                mix={on("submit", async event => {
                    event.preventDefault();

                    // 1. Optimistic update
                    liked = !liked;
                    submitting = true;
                    let signal = await handle.update();

                    try {
                        // 2. Send to server
                        let response = await fetch(event.currentTarget.action, {
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
                })}
            >
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
export let SearchInput = clientEntry(import.meta.url, (handle: Handle) => {
    // Re-render when navigation state changes (for loading indicator)
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return (props: { query?: string }) => {
        let searching = Boolean(navigating.to.url?.searchParams.has("q"));

        return (
            <form method="GET">
                <input
                    defaultValue={props.query ?? undefined}
                    mix={on("input", async event => {
                        let url = new URL(location.href);

                        if (!event.currentTarget.value.trim()) {
                            url.searchParams.delete("q");
                        } else {
                            url.searchParams.set("q", event.currentTarget.value);
                        }

                        let isFirstSearch = new URL(location.href).searchParams.get("q") === null;

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
<a href={url} rmx-target="content">
    Click me
</a>;
```

**Server-side frame detection:** The server knows which frame is being requested via the `x-remix-target` header. Your controller checks this to decide what to render:

```tsx
let target = request.headers.get("x-remix-target");

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
        let url = new URL(src, ctx?.currentFrameSrc ?? context.url);
        let headers = new Headers({ accept: "text/html" });
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

export let routes = route({
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
resources("/posts", { exclude: ["index", "new"] });
```

**Custom routes:** Add any custom route as an object with `method` and `pattern`. Parameters use `:name` syntax.

**Using routes in components (type-safe URL generation):**

```tsx
routes.posts.show.href({ id: 42 }); // "/posts/42"
routes.posts.edit.href({ id: 42 }, { tab: "meta" }); // "/posts/42/edit?tab=meta"
routes.home.href(); // "/"
```

**Mapping routes to controllers in the server entry:**

```tsx
router.map(routes.home, async () => {
    /* ... */
});
router.map(routes.posts, postsController); // Maps all sub-routes to a controller
```

---

### 7. How do I structure my server entry?

**Decision:** What middleware do I need and in what order?

**Heuristic:** Middleware runs in order for every request. Put cheap/broad middleware first, expensive/specific middleware last.

**Recommended middleware stack:**

```tsx
export let router = createRouter({
    middleware: [
        staticFiles("./public"), // 1. Serve static files (short-circuits)
        staticFiles("./dist/client"), // 2. Serve built client assets
        formData(), // 3. Parse multipart/urlencoded form data
        methodOverride(), // 4. Rewrite _method field to real HTTP method
        asyncContext(), // 5. Enable request-scoped context (getContext())
        await loadDatabase(), // 6. Initialize database, inject into context
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

| Logic type                                     | Where it goes                   | Why                          |
| ---------------------------------------------- | ------------------------------- | ---------------------------- |
| Request handling for a specific route          | **Controller** (`controllers/`) | Tied to a route's URL/method |
| Cross-cutting concern (auth, logging, parsing) | **Middleware** (`lib/`)         | Runs across many routes      |
| UI rendering                                   | **Component** (`components/`)   | Presentation layer           |
| Data access / business rules                   | **Lib utilities** (`lib/`)      | Reusable, testable           |
| Validation schemas                             | **`lib/schemas.ts`**            | Shared between controllers   |
| Rendering helpers (document, frame)            | **`lib/render.tsx`**            | Shared rendering logic       |

**Controllers** are objects that satisfy the `Controller` type. They map route actions to handler functions:

```tsx
export default {
    actions: {
        async index(context) {
            /* ... */
        },
        async show(context) {
            /* ... */
        },
        async create(context) {
            /* ... */
        },
        async update(context) {
            /* ... */
        },
        async destroy(context) {
            /* ... */
        },
    },
} satisfies Controller<typeof routes.posts>;
```

The `satisfies Controller<typeof routes.posts>` ensures your action names match the route definitions. Each action receives the request context with typed `params` based on the route pattern.

**Middleware** is a function that receives `(context, next)` and returns a `Response`:

```tsx
async (context, next) => {
    context.set(Database, db);
    return next();
};
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
let SearchSchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

// Form data with coercion: string "true"/"false" -> boolean
let ToggleSchema = f.object({
    enabled: f.field(coerce.boolean()),
});

// Form data with defaults: missing fields become empty strings
let ProfileSchema = f.object({
    name: f.field(s.defaulted(s.string(), "")),
    email: f.field(s.defaulted(s.string(), "")),
    bio: f.field(s.defaulted(s.string(), "")),
});
```

**Parsing in controllers:**

```tsx
// Parse search params (URLSearchParams)
let { q } = s.parse(SearchSchema, context.url.searchParams);

// Parse form data (FormData from request body)
let { enabled } = s.parse(ToggleSchema, context.get(FormData));
let profile = s.parse(ProfileSchema, context.get(FormData));
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
export let navigating = new Navigating();
```

It exposes:

- `navigating.to.state` - `"idle"`, `"loading"`, or `"submitting"`
- `navigating.to.url` - the destination URL (or `null` when idle)
- `navigating.to.formData` - form data if submitting (or `null`)
- `navigating.from.url` - the URL that was active when the navigation started (or `null`)

**Listening for navigation changes in a component:**

```tsx
export let MyComponent = clientEntry(import.meta.url, (handle: Handle) => {
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return () => {
        let isLoading = navigating.to.state === "loading";
        return <div class={isLoading ? "loading" : ""}>...</div>;
    };
});
```

**Deriving pending state for specific items** (e.g., which list item is about to become active):

```tsx
let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
let isPending = Number(destination?.params.id) === item.id;
```

This avoids managing per-item loading state. The navigation destination tells you which item is being navigated to.

**Idle values are `null`, not `undefined`:** When no navigation is in progress, `navigating.to.url` and `navigating.to.formData` are `null`. Use optional chaining (`navigating.to.url?.searchParams`) to safely access properties.

**Server safety:** `Navigating` is safe to instantiate on the server -- it skips event listener registration when `typeof window === "undefined"`. Components can reference `navigating` without conditional imports, but should guard client-only logic with `isServer` checks.

---

### 11. How does SPA navigation work with frames?

**Decision:** How do I set up client-side navigation that works with the frame system?

**Heuristic:** The client entry (`entry.browser.ts`) sets up three things in a specific order: a form submission listener, the Remix runtime via `run()`, and a focus-reset listener. The ordering matters because the Navigation API uses "last `intercept()` call wins" semantics for options like `focusReset`.

**The three-phase client entry:**

```tsx
import { navigate, run } from "remix/component";

// Phase 1: Form submission handler (before `run`)
navigation.addEventListener("navigate", async event => {
    if (!event.canIntercept) return;

    // Programmatic navigations: handled by built-in listener
    if (!event.sourceElement) return;
    // Anchors: handled by built-in listener
    if (event.sourceElement.closest("a, area")) return;

    // sourceElement is <button type="submit"> inside form submissions.
    // Read rmx-* attributes from the button for frame targeting.
    let target = event.sourceElement.getAttribute("rmx-target") ?? undefined;
    let src = event.sourceElement.getAttribute("rmx-src") ?? undefined;
    let resetScroll = event.sourceElement.hasAttribute("rmx-reset-scroll") ?? undefined;

    // Form POST submission
    if (event.formData) {
        event.intercept({
            focusReset: "manual",
            async handler() {
                let response = await fetch(event.destination.url, {
                    method: "POST",
                    body: event.formData,
                    signal: event.signal,
                });
                navigate(response.url, { target, src, resetScroll });
            },
        });
        return;
    }

    // Form GET submission
    event.preventDefault();
    navigate(event.destination.url, { target, src, resetScroll });
});

// Phase 2: Remix runtime
run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    async resolveFrame(src, signal, target) {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        let response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    },
});

// Phase 3: Focus reset (after `run`, last intercept() call wins)
navigation.addEventListener("navigate", event => {
    if (!event.canIntercept || event.defaultPrevented || event.navigationType === "traverse") {
        return;
    }
    event.intercept({ focusReset: "manual" });
});
```

**Why three phases:**

1. **Phase 1 (before `run`):** Handles form submissions. Must register before `run()` so that `event.preventDefault()` on GET forms works before the Remix listener sees the event. Reads `rmx-target`, `rmx-src`, and `rmx-reset-scroll` from the submit button's attributes.
2. **Phase 2 (`run`):** Initializes the Remix runtime — module loading for hydrated components and frame resolution for fetching frame content.
3. **Phase 3 (after `run`):** Sets `focusReset: "manual"` for all non-traverse navigations. Registered last so its `intercept()` call wins, preventing the browser from resetting focus to the top of the page during frame updates.

**Why `event.sourceElement`:** For form submissions triggered by a submit button, `event.sourceElement` is that `<button>`. This is how `rmx-*` attributes on form buttons work -- the listener reads them directly from the submitting element and passes them to `navigate()`.

**Why traverse navigations are left alone:** Back/forward navigations are handled by the built-in Remix listener. Intercepting them again would conflict.

---

### 12. How should I manage history (push vs. replace)?

**Decision:** When should a navigation create a new history entry vs. replace the current one?

**Heuristic:**

| Scenario                                           | History mode            | Why                                                       |
| -------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| User clicks a link to a new page                   | **push** (default)      | Back button should return to previous page                |
| Search-as-you-type (after first keystroke)         | **push**                | Back button navigates between search states               |
| First search keystroke                             | **replace**             | Don't create an entry for the pre-search state with `?q=` |
| Optimistic update sync (`navigate(location.href)`) | **replace**             | Syncing server state shouldn't create history             |
| Removing a query param (clearing search)           | **push** or **replace** | Depends on whether "cleared search" is a meaningful state |

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
export let Database = createContextKey<DataTable>();
```

**Set it in middleware:**

```tsx
export async function loadDatabase(): Promise<Middleware> {
    let db = createDatabase(sqliteAdapter(new SQLite(":memory:")));
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
let db = context.get(Database);

// In a utility function (via async context):
import { getContext } from "remix/async-context-middleware";
let db = getContext().get(Database);
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
export let SearchInput = clientEntry(import.meta.url, (handle: Handle) => {
    // Setup: runs once on hydration
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return (props: { query?: string }) => {
        // Render: runs on every update
        let searching = Boolean(navigating.to.url?.searchParams.has("q"));
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

### 15. How do I use `rmx-*` attributes for declarative frame targeting?

**Decision:** How do I target a specific frame from links and forms without writing JavaScript?

**Heuristic:** Use `rmx-*` attributes to declaratively control frame navigation. These work on both `<a>` tags and form `<button type="submit">` elements.

**On links:**

```tsx
<a href={routes.posts.show.href({ id: post.id })} rmx-target="content">
    {post.title}
</a>
```

When the Remix client runtime intercepts this navigation, it reads the `rmx-target` attribute and passes it as the `target` parameter to `resolveFrame`. The server receives it as the `x-remix-target` header.

**On form buttons:**

```tsx
<form action={routes.posts.create.href()} method="POST">
    <button rmx-target="content" type="submit">
        New
    </button>
</form>
```

For form submissions, the client entry's navigate listener reads `rmx-*` attributes from `event.sourceElement` -- the submit button, not the `<form>`. This means a server-only form can target a specific frame without hydration.

**Available attributes:**

| Attribute          | Purpose                               | Example                      |
| ------------------ | ------------------------------------- | ---------------------------- |
| `rmx-target`       | Target a named frame                  | `rmx-target="content"`       |
| `rmx-src`          | Override the frame content source URL | `rmx-src="/posts/sidebar"`   |
| `rmx-reset-scroll` | Reset scroll position on frame update | `rmx-reset-scroll` (boolean) |

All three are the declarative equivalents of the options you can pass to `navigate()`:

```tsx
navigate(url, { target: "content", src: "/posts/sidebar", resetScroll: true });
```

**Use `rmx-*` attributes for links and form buttons. Use `navigate()` with options for programmatic navigation.** They work identically under the hood.

---

### 16. How do I handle the full-page vs. frame response decision?

**Decision:** My controller handles the same route for initial loads and frame updates. How do I return the right response?

**Heuristic:** Check the `x-remix-target` header to determine which frame (if any) is being requested. Each controller action should handle both full-page and frame-targeted requests.

```tsx
async function renderPage(context, contentRenderer) {
    let target = getContext().request.headers.get("x-remix-target");

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

### 17. How should I define database tables, migrations, and queries?

**Decision:** How do I set up typed database access with `remix/data-table`?

**Heuristic:** Define table schemas using `column` and `table`, derive TypeScript types with `TableRow`, use migration utilities to create tables, and access the database through the request context.

**Table definition:**

```tsx
import { column as c, table, type TableRow } from "remix/data-table";

export let Posts = table({
    name: "posts",
    columns: {
        id: c.integer().primaryKey(),
        title: c.text().notNull(),
        body: c.text().notNull(),
        published: c.boolean().default(false),
        createdAt: c.timestamp().defaultNow(),
    },
});

export type Post = TableRow<typeof Posts>;
```

**Timestamp columns:** Use `c.timestamp().defaultNow()` for creation timestamps. The value is automatically populated on insert -- you don't need to pass it when creating records:

```tsx
// createdAt is filled in automatically
let post = await db.create(Posts, { title: "Hello", body: "World" }, { returnRow: true });
```

**Migrations:** Use `remix/data-table/migrations` to create and manage tables. Migrations derive table structure from the `table()` definition, so the schema is defined once.

```tsx
import {
    createMigration,
    createMigrationRegistry,
    createMigrationRunner,
} from "remix/data-table/migrations";

let createPosts = createMigration({
    async up({ schema }) {
        await schema.createTable(Posts);
        await schema.createIndex(Posts, ["title", "createdAt"]);
    },
    async down({ schema }) {
        await schema.dropTable(Posts, { ifExists: true });
    },
});
```

**Running migrations** in your database middleware:

```tsx
let registry = createMigrationRegistry();
registry.register({
    id: crypto.randomUUID(),
    name: "create_posts",
    migration: createPosts,
});
let runner = createMigrationRunner(adapter, registry);
await runner.up();
```

`schema.createTable()` reads column definitions directly from the `table()` call, so you never write raw SQL for table creation. `schema.createIndex()` takes the table and an array of column names.

**Query functions** access the database through context:

```tsx
export async function getPosts(): Promise<Post[]> {
    let db = getContext().get(Database);
    return await db.findMany(Posts);
}
```

**Key pattern:** Data access functions use `getContext()` to get the database rather than accepting it as a parameter. This keeps function signatures clean and works anywhere in the call stack as long as `asyncContext()` middleware is active.

---

### 18. How do I evolve my database schema over time?

**Decision:** My app is already running in production and I need to add a column, rename a table, or make another schema change. How do I manage this?

**Heuristic:** Use migration files -- one per schema change, timestamped and ordered. Each migration has an `up` (apply) and `down` (revert) function. A migration runner tracks which migrations have been applied in a journal table and only runs new ones.

**Project structure:**

```
app/
  db/
    migrations/
      20260228090000_create_posts.ts
      20260315140000_add_published_at.ts
      20260320100000_add_tags.ts
    migrate.ts
```

Name each file as `YYYYMMDDHHmmss_name.ts`. The `id` and `name` are inferred from the filename. Each file default-exports a `createMigration(...)`.

**Writing a migration that adds a column:**

```tsx
import { column as c } from "remix/data-table";
import { createMigration } from "remix/data-table/migrations";
import { Posts } from "../tables.ts";

export default createMigration({
    async up({ schema }) {
        await schema.alterTable(Posts, table => {
            table.addColumn("publishedAt", c.timestamp({ withTimezone: true }));
        });
    },
    async down({ schema }) {
        await schema.alterTable(Posts, table => {
            table.dropColumn("publishedAt");
        });
    },
});
```

**Other common `alterTable` operations:**

```tsx
await schema.alterTable(Posts, table => {
    // Add columns
    table.addColumn("subtitle", c.text());

    // Drop columns
    table.dropColumn("subtitle");

    // Add keys and constraints
    table.addPrimaryKey("id");
    table.addForeignKey("author_id", "authors", "id");
    table.addForeignKey(["tenant_id", "author_id"], "authors", ["tenant_id", "id"]);
});
```

You can also run data migrations alongside schema changes using the `db` handle:

```tsx
import { sql } from "remix/data-table";

export default createMigration({
    async up({ db, schema }) {
        await schema.alterTable(Posts, table => {
            table.addColumn("status", c.text().notNull().default("draft"));
        });

        // Backfill: set existing published posts to "published"
        await db.exec(sql`update posts set status = 'published' where published = true`);
    },
    async down({ schema }) {
        await schema.alterTable(Posts, table => {
            table.dropColumn("status");
        });
    },
});
```

**Defensive checks:** Use `schema.hasTable()` and `schema.hasColumn()` when you need conditional behavior:

```tsx
async up({ schema }) {
    if (await schema.hasColumn(Posts, "legacy_field")) {
        await schema.alterTable(Posts, table => {
            table.dropColumn("legacy_field");
        });
    }
}
```

**Creating a runner script** (`app/db/migrate.ts`):

```tsx
import path from "node:path";
import { createSqliteDatabaseAdapter as sqliteAdapter } from "remix/data-table-sqlite";
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";

let adapter = sqliteAdapter(/* your database connection */);
let migrations = await loadMigrations(path.resolve("app/db/migrations"));
let runner = createMigrationRunner(adapter, migrations);

let direction = process.argv[2] === "down" ? "down" : "up";
let result = direction === "up" ? await runner.up() : await runner.down();

console.log(direction + " complete", {
    applied: result.applied.map(entry => entry.id),
    reverted: result.reverted.map(entry => entry.id),
});
```

**Runner options:**

| Option         | Purpose                                       | Example                                                                          |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| `to`           | Migrate up/down to a specific migration ID    | `runner.up({ to: "20260315140000" })`                                            |
| `step`         | Apply or revert a fixed number of migrations  | `runner.down({ step: 1 })`                                                       |
| `dryRun`       | Compile and inspect SQL without applying      | `runner.up({ dryRun: true })`                                                    |
| `journalTable` | Custom name for the migrations tracking table | `createMigrationRunner(adapter, migrations, { journalTable: "app_migrations" })` |

```sh
node ./app/db/migrate.ts up
node ./app/db/migrate.ts up 20260315140000   # migrate to a specific version
node ./app/db/migrate.ts down                # revert all
node ./app/db/migrate.ts down 20260228090000 # revert to a specific version
```

**The development workflow:**

When you need to change your schema, you update two things together in the same commit:

1. **Update the `table()` definition** in your source code to reflect the desired schema (e.g., add the new column to the `columns` object)
2. **Write a migration file** that transitions the database from the old schema to the new one (e.g., `schema.alterTable` with `table.addColumn`)

The `table()` definition is the source of truth for what the schema looks like _now_. The migration file describes _how to get there_ from the previous state. Both ship together in the same deploy.

**At deploy time**, run migrations before starting the app:

```sh
node ./app/db/migrate.ts up && node ./server.ts
```

This ensures the database schema matches what the new code expects. The runner's journal table tracks which migrations have already been applied, so running `up` is always safe -- it only applies new migrations.

**Key principles:**

- **One migration per change:** Each migration should do one logical thing (add a column, create a table, backfill data). This keeps rollbacks predictable.
- **Migrations are append-only:** Never edit a migration that has already been applied in production. Write a new migration instead.
- **Table definition and migration in the same commit:** The `table()` definition describes the _current_ state; the migration describes the _transition_. Shipping them together guarantees the code and database stay in sync.
- **Use `dryRun` in CI:** Review generated SQL before deploying to catch dialect-specific issues.

---

### 19. How do I handle redirects after mutations?

**Decision:** What should happen after a create/update/delete?

**Heuristic:** Follow the Post/Redirect/Get pattern. After every mutation, redirect to the appropriate page:

```tsx
// After create: redirect to the edit page for the new record
async create() {
    let id = await createPost();
    return redirect(routes.posts.edit.href({ id }));
}

// After update: redirect to the show page
async update(context) {
    let data = s.parse(PostSchema, context.get(FormData));
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
    let { enabled } = s.parse(ToggleSchema, context.get(FormData));
    let updated = await updateItem(Number(context.params.id), { enabled });
    return Response.json(updated);
}
```

The client handles the state update optimistically and doesn't need a redirect.

---

### 20. How do I configure Vite+ for a Remix project?

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
    fmt: {
        /* Oxfmt options */
    },
    lint: {
        /* Oxlint options */
    },
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

### 21. How do I derive active/pending state for navigation items?

**Decision:** How does a list item know if it's currently active or being navigated to?

**Heuristic:** Use route pattern matching against the current URL (for active) and the navigation destination URL (for pending). This is necessary because frame-targeted navigations only update one frame -- components in other frames don't re-render, so server-provided props become stale.

```tsx
import { ArrayMatcher } from "remix/route-pattern";

// Set up a matcher for the routes this item could match
let matcher = new ArrayMatcher<true>();
matcher.add(routes.posts.show.pattern, true);
matcher.add(routes.posts.edit.pattern, true);

// In the render function:
let currentMatch = !isServer ? matcher.match(location.href) : null;
let isActive = Number(currentMatch?.params?.id ?? selected) === item.id;

// Pending: destination matches this item but isn't the current page
let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
let isPending =
    !isActive &&
    navigating.to.url?.pathname !== location.pathname &&
    Number(destination?.params.id) === item.id;
```

**Why derive from URL instead of props:** Frame-targeted navigations don't re-render components outside the targeted frame. A server-provided `selected` prop becomes stale after client-side navigation. Reading `window.location.href` directly gives the true current state.

**The `selected` prop serves as a server fallback** for the initial render and non-JS environments. On the client, the URL-derived state takes precedence.

---

### 22. How do I update the document title during frame navigations?

**Decision:** How do I change `<title>` when frame content changes without a full page load?

**Heuristic:** When using frames, navigating between frame content doesn't trigger a full page load, so the `<title>` in `<head>` never changes. Use a hydrated `<Title>` component that sets `document.title` on both the server and the client.

**The pattern:**

```tsx
import { clientEntry } from "remix/component";
import { isServer } from "~/lib/navigating.ts";

export let Title = clientEntry(import.meta.url, () => {
    return ({ children }: { children: string | string[] }) => {
        let title = Array.isArray(children) ? children.join("") : children;

        if (isServer) {
            // Inline script sets document.title during HTML parsing, before
            // hydration JS loads, eliminating the flash of the default title.
            return <script>{`document.title=${JSON.stringify(title)}`}</script>;
        } else {
            // Client title changes for when navigating between frames.
            document.title = title;
        }
    };
});
```

**Usage in frame content components:**

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

**How it works:**

- **Server:** Renders an inline `<script>` tag that sets `document.title` during HTML parsing. This runs before hydration JS loads, avoiding a flash of the default title set in `<head>`.
- **Client:** Sets `document.title` directly during the render phase when navigating between frames.

Place `<Title>` in any frame content component that should update the document title. The base `<title>` tag in your document's `<head>` serves as the default for initial load and no-JS environments.

---

### 23. How do asset imports work in the document shell?

**Decision:** How do I wire up scripts, stylesheets, and preload links in my HTML document?

**Heuristic:** Use Vite's asset import specifiers to resolve paths at build time. Never hardcode asset paths in components.

**The three import types:**

```tsx
// Client entry module — resolves hydration script + its dependencies
import clientAssets from "~/entry.browser.ts?assets=client";

// SSR assets — resolves server-rendered module dependencies (CSS, JS preloads)
import serverAssets from "~/entry.server.tsx?assets=ssr";

// Standalone stylesheet — resolves to a URL string
import styles from "~/index.css?url";
```

**Merging assets in the document shell:**

```tsx
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import clientAssets from "~/entry.browser.ts?assets=client";
import serverAssets from "~/entry.server.tsx?assets=ssr";
import styles from "~/index.css?url";

export function Document() {
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                {/* Standalone CSS file — use ?url import */}
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
            <body>{/* ... */}</body>
        </html>
    );
}
```

**Key rules:**

- Use `?assets=client` for the client entry module (the one passed to `run()`)
- Use `?assets=ssr` for server-rendered modules that contribute CSS or JS to the document. Only use this for module assets (`.tsx`, `.ts`), not plain `.css` files
- Use `?url` for standalone stylesheets — this gives you a plain URL string for a `<link>` tag
- Render `clientAssets.entry` as the `<script>` src — never hardcode `/remix/assets/...` paths
- The Remix Vite plugin transforms `import.meta.url` in `clientEntry()` calls into the correct `?assets=client` imports automatically, so you don't need to think about this in component files

---

### 24. How should I style components?

**Decision:** Should I use CSS files, the `css()` mixin, or inline `style`?

**Heuristic:** Prefer external `.css` files for app-wide styles. Use the `css()` mixin for component-scoped static rules when you don't want a separate stylesheet. Use `style` only for truly dynamic values, and prefer setting CSS custom properties over direct inline styles.

**External CSS (default choice):**

```tsx
import styles from "~/index.css?url";

// In your document shell:
<link href={styles} rel="stylesheet" />;
```

**The `css()` mixin for component-scoped rules:**

```tsx
import { css } from "remix/component";

<button
    mix={[
        css({
            color: "white",
            backgroundColor: "var(--color-primary)",
            "&:hover": { backgroundColor: "var(--color-primary-dark)" },
            "&:focus-visible": { outline: "2px solid var(--color-focus)" },
            "@media (max-width: 768px)": { width: "100%" },
        }),
    ]}
>
    Submit
</button>;
```

`css()` supports nested selectors (`&:hover`, `&::before`), media queries, and pseudo-elements — things you can't do with `style`. It generates real stylesheet rules, so it's more performant than inline styles for static values.

**Dynamic values with CSS custom properties:**

When a value changes based on state, set a CSS custom property via `style` and reference it from `css()` or your stylesheet:

```tsx
<div
    mix={[
        css({
            backgroundColor: "var(--bg)",
            transition: "background-color 200ms ease",
        }),
    ]}
    style={{ "--bg": isActive ? "var(--color-active)" : "var(--color-muted)" }}
>
    {children}
</div>
```

**Why custom properties over direct inline styles:** CSS custom properties keep your styling in one system. Stylesheets and `css()` rules can reference the same property, transitions work naturally, and you avoid specificity fights between inline styles and your CSS rules.

**When to use each:**

| Approach                       | Use for                                       | Example                                         |
| ------------------------------ | --------------------------------------------- | ----------------------------------------------- |
| `.css` files                   | App-wide layout, typography, resets           | Global stylesheet                               |
| `css()` mixin                  | Component-scoped static rules with selectors  | Hover states, media queries, pseudo-elements    |
| `style` with custom properties | Dynamic values that change with state         | Active/inactive colors, computed positions      |
| Direct `style`                 | Rare — only for truly one-off computed values | `style={{ transform: \`translateX(${x}px)\` }}` |

---

### 25. How do I access DOM nodes directly?

**Decision:** I need to focus an input, measure an element, or do other imperative DOM work.

**Heuristic:** Use the `ref()` mixin to get a callback with the DOM node. For work that depends on updated rendered state (focus after a state change, measurement after layout), use `handle.queueTask()` instead.

**Basic ref (fires on insert):**

```tsx
import { ref } from "remix/component";

<input mix={[ref(node => node.focus())]} />;
```

**Storing a ref for later use:**

```tsx
let textareaNode: HTMLTextAreaElement | undefined;

return () => (
    <textarea
        mix={[
            ref(node => {
                textareaNode = node;
            }),
            on("input", () => {
                if (textareaNode) {
                    textareaNode.style.height = "auto";
                    textareaNode.style.height = `${textareaNode.scrollHeight}px`;
                }
            }),
        ]}
    />
);
```

**When to use `ref()` vs `handle.queueTask()`:**

- `ref()` fires when the node is first inserted into the DOM — use it for one-time setup (autofocus, attaching third-party libraries, storing the node reference)
- `handle.queueTask()` runs after each render commit — use it when you need the DOM to reflect the latest state before doing measurement, focus, or scroll work (see Recipe 28)

---

### 26. How do I animate elements?

**Decision:** How do I add enter, exit, or layout animations to elements?

**Heuristic:** Use the animation mixins — `animateEntrance()`, `animateExit()`, and `animateLayout()`. Always provide a stable `key` on elements that should transition.

**Enter animation:**

```tsx
import { animateEntrance } from "remix/component";

<div
    mix={[
        animateEntrance({
            opacity: 0,
            transform: "translateY(8px)",
            duration: 180,
            easing: "ease-out",
        }),
    ]}
/>;
```

**Toggle visibility with enter + exit:**

```tsx
import { animateEntrance, animateExit } from "remix/component";

{
    isVisible && (
        <div
            key="panel"
            mix={[
                animateEntrance({ opacity: 0, transform: "scale(0.98)", duration: 180 }),
                animateExit({
                    opacity: 0,
                    transform: "scale(0.98)",
                    duration: 120,
                    easing: "ease-in",
                }),
            ]}
        />
    );
}
```

**List reordering with layout animation:**

```tsx
import { animateLayout, spring } from "remix/component";

{
    items.map(item => (
        <li key={item.id} mix={[animateLayout({ ...spring({ duration: 500, bounce: 0.2 }) })]}>
            {item.name}
        </li>
    ));
}
```

**Shared-layout swap (crossfade between two states):**

```tsx
<div mix={[css({ display: "grid", "& > *": { gridArea: "1 / 1" } })]}>
    {state ? (
        <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
    ) : (
        <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
    )}
</div>
```

**Practical guidance:**

- Always `key` conditional or list elements you expect to transition
- Use `animateLayout()` only on the element whose position or size changes
- For spring-style timing, spread `spring()` or `spring("snappy")` into the mixin config
- Default to `...spring()` for duration and easing in most cases — it produces natural motion
- Keep one clear intent per mixin: entrance starts from an initial style, exit ends at a final style

---

### 27. How do I handle keyboard and press interactions?

**Decision:** I need keyboard shortcuts, key-specific handlers, or unified pointer+keyboard press behavior.

**Heuristic:** Use the built-in interaction helpers from `remix/component` instead of writing your own keyboard/pointer normalization. Prefer `rmx-target` attributes on anchors and buttons over the `link()` mixin for navigation.

**`keysEvents()` — key-specific host events:**

```tsx
import { keysEvents } from "remix/component";

<div
    tabindex="0"
    mix={[
        keysEvents({
            Escape() {
                closePanel();
                handle.update();
            },
            ArrowDown(event) {
                event.preventDefault();
                focusNextItem();
            },
            ArrowUp(event) {
                event.preventDefault();
                focusPreviousItem();
            },
        }),
    ]}
/>;
```

Use `keysEvents()` when you need to respond to specific keys on a focusable element. It handles `keydown` dispatch by key name so you don't need to write `if (event.key === "Escape")` branching yourself.

**`pressEvents()` — unified pointer and keyboard input:**

```tsx
import { pressEvents } from "remix/component";

<div
    role="button"
    tabindex="0"
    mix={[
        pressEvents({
            onPress() {
                toggleSelection();
                handle.update();
            },
            onLongPress() {
                openContextMenu();
                handle.update();
            },
        }),
    ]}
/>;
```

Use `pressEvents()` when a non-button element needs to behave like an interactive control across both pointer and keyboard input. It normalizes click, touch, and Enter/Space into a single interaction model.

**`link()` — navigation behavior on non-anchor elements:**

```tsx
import { link } from "remix/component";

<div mix={[link(routes.posts.show.href({ id }), { target: "content" })]} />;
```

The `link()` mixin makes any element behave like a Remix navigation link. However, prefer real `<a>` tags or `<form><button type="submit"></button></form>` tags with `rmx-target` attributes in most cases — they're more accessible, work without JavaScript, and are easier to understand. Reserve `link()` for cases where an anchor or button tag isn't practical (e.g., a complex interactive card that needs to navigate on click).

---

### 28. How do I do post-render DOM work?

**Decision:** I need to focus an element, scroll to a position, or measure layout after a state change.

**Heuristic:** Use `handle.queueTask()` for work that depends on the DOM reflecting the latest render. Use `await handle.update()` when you need to chain state change → DOM work sequentially in an event handler.

**`handle.queueTask()` — runs after each render commit:**

```tsx
export let Accordion = clientEntry(import.meta.url, (handle: Handle) => {
    let open = false;
    let contentNode: HTMLElement | undefined;

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
                Toggle
            </button>
            {open && (
                <div
                    mix={[
                        ref(node => {
                            contentNode = node;
                        }),
                    ]}
                >
                    {handle.queueTask(() => {
                        contentNode?.querySelector("input")?.focus();
                    })}
                    <input placeholder="Now focused" />
                </div>
            )}
        </div>
    );
});
```

**`await handle.update()` — sequential state-then-DOM in event handlers:**

```tsx
on("submit", async event => {
    event.preventDefault();
    submitting = true;
    let signal = await handle.update();

    // DOM now reflects submitting=true, safe to read layout or focus
    let response = await fetch(url, { method: "POST", body: formData, signal });
    // ...
});
```

The `await` on `handle.update()` waits for the render commit and returns an `AbortSignal` that cancels if the component unmounts.

**When to use each:**

| Pattern                 | Use for                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `handle.queueTask(fn)`  | Post-render work triggered by state changes in render (focus, scroll, measurement) |
| `await handle.update()` | Sequential async flows where you need the DOM updated before continuing            |
| `ref(node => ...)`      | One-time setup when the node is first inserted (see Recipe 25)                     |

**Important:** When state changes what exists in the DOM (e.g., conditionally rendering an element), always do focus, scroll, and measurement work in `handle.queueTask()` or after `await handle.update()` — never inline in the render function, since the DOM hasn't committed yet.

---

### 29. When should I use persistent listeners vs session-based listeners?

**Decision:** Should this event listener live for the element's entire lifetime, or only during an active interaction?

**Heuristic:** Use `mix={[on(...)]}` for behavior that should always be active. Use imperative `addEventListener` with a scoped `AbortController` for listeners that should only exist during a short-lived interaction session (like a drag, a resize handle, or a long-press).

**Persistent listener (always active):**

```tsx
<div
    mix={[
        on("pointerdown", event => {
            startDragSession(event);
        }),
    ]}
/>
```

The `on()` mixin attaches when the element mounts and detaches when it unmounts. It survives re-renders.

**Session-based listeners (active only during interaction):**

```tsx
on("pointerdown", event => {
    let controller = new AbortController();
    let { signal } = controller;

    // These listeners only exist while dragging
    addEventListener(
        "pointermove",
        event => {
            updatePosition(event);
            handle.update();
        },
        { signal },
    );

    addEventListener(
        "pointerup",
        () => {
            finishDrag();
            controller.abort(); // Tear down all session listeners
            handle.update();
        },
        { signal },
    );

    addEventListener(
        "pointercancel",
        () => {
            cancelDrag();
            controller.abort();
            handle.update();
        },
        { signal },
    );
});
```

**Why this matters:** Persistent `pointermove` listeners on `window` that are only useful during a drag are wasteful and can cause subtle bugs if they fire between interactions. Scoping listeners to a session signal makes cleanup automatic and explicit.

**The rule of thumb:**

| Listener type                  | Pattern                                              | Example                                             |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| Always needed while mounted    | `mix={[on(...)]}`                                    | Click handlers, submit handlers, keyboard shortcuts |
| Only needed during interaction | Imperative `addEventListener` with `AbortController` | Drag tracking, resize handles, pointer capture      |
| Global, for component lifetime | `addEventListeners(target, handle.signal, {...})`    | Window resize, navigation state changes             |

---

### 30. When and how do I create reusable mixins?

**Decision:** Should I extract this behavior into a `createMixin()`, or keep it local?

**Heuristic:** Reach for `createMixin()` only when the behavior is genuinely reusable host-element behavior that composes low-level DOM events into a semantic interaction. If the logic is local submit state, a one-off event handler, or a small async helper, keep it in the component.

**When to use `createMixin()`:**

- You're packaging reusable host behavior that composes low-level DOM events into one semantic interaction (e.g., drag-and-drop, hold-to-confirm, swipe gestures)
- The interaction keeps timing/pointer/gesture state that belongs to the host element
- You want to dispatch custom events or attach reusable behavior to different elements

**When NOT to use `createMixin()`:**

- The logic is only used once — prefer `on()` + setup-scope state
- The shared part is an async helper or request helper — share the helper, not a mixin
- It's form-local state (`submitting`, `error`) — keep it in the component
- You're doing it to feel "more Remix-like" — only extract when it pays for itself

**Basic mixin — pure prop transform:**

```tsx
import { createMixin } from "remix/component";

let withTitle = createMixin(() => (title: string, props: { title?: string }) => (
    <handle.element {...props} title={title} />
));
```

**Lifecycle-managed mixin — imperative setup on insert:**

```tsx
let withAutofocus = createMixin<HTMLElement>(handle => {
    handle.addEventListener("insert", event => {
        event.node.focus();
    });

    return props => <handle.element {...props} />;
});
```

**Core lifecycle semantics:**

1. A mixin handle is tied to one mounted host node lifecycle
2. `insert` fires when the host node is available for imperative setup
3. `remove` fires for teardown of that lifecycle
4. `handle.queueTask(fn)` runs post-commit and receives `(node, signal)` for mixins
5. Render functions should stay pure — side effects belong in `insert`, `remove`, or queued work

**Post-commit DOM work in a mixin:**

```tsx
handle.queueTask((node, signal) => {
    node.removeEventListener(prevType, stableHandler);
    node.addEventListener(nextType, stableHandler);
});
```

Only use `signal` when the work is async or cancellation-sensitive. Don't add `signal.aborted` checks for purely synchronous work.

---

### 31. How do I use SVG sprites?

**Decision:** How should I manage icons and SVG assets?

**Heuristic:** Use an SVG sprite sheet — a single SVG file containing all icons as `<symbol>` elements. Import the sprite URL from the source asset and reference individual icons by fragment ID. Never hardcode sprite paths.

**Setting up the sprite file** (`app/icons.svg`):

```xml
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <symbol id="icon-search" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </symbol>
        <symbol id="icon-plus" viewBox="0 0 24 24">
            <path d="M12 4.5v15m7.5-7.5h-15"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </symbol>
        <symbol id="icon-trash" viewBox="0 0 24 24">
            <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </symbol>
    </defs>
</svg>
```

**Importing the sprite:**

```tsx
import iconsHref from "~/icons.svg?url";
```

**Using icons in components:**

```tsx
function Icon(props: { name: string; size?: number }) {
    let size = props.size ?? 20;
    return () => (
        <svg aria-hidden="true" width={size} height={size}>
            <use href={`${iconsHref}#icon-${props.name}`} />
        </svg>
    );
}

// Usage:
<Icon name="search" />
<Icon name="plus" size={16} />
<Icon name="trash" size={24} />
```

**Key rules:**

- Import the sprite with `?url` so Vite resolves the correct path in both dev and production builds
- Reference icons with `<use href={...}>` using the sprite URL + `#symbol-id`
- Use `aria-hidden="true"` on decorative icons. For meaningful icons, add an accessible label via `aria-label` on the `<svg>` or wrap it with visually hidden text
- Use `currentColor` for `stroke` and `fill` in the sprite so icons inherit their color from CSS
- Keep all icons in a single sprite file for a single network request — the browser caches it across pages

**Adding new icons:** Add a new `<symbol>` element to the sprite file with a unique `id` and `viewBox`. Reference it with the same `Icon` component pattern. No build step or code generation needed.

**Why sprites over inline SVGs:** Inline SVGs duplicate markup in every instance and increase HTML payload. A sprite is fetched once, cached, and each `<use>` reference is just a few bytes. This is especially important in server-rendered apps where you want to minimize HTML size.

---

### 32. How do I test components?

**Decision:** How do I write unit tests for Remix components?

**Heuristic:** Use `createRoot()` to mount components in a real DOM container, and `root.flush()` to synchronously process renders and queued tasks. Test through real DOM interactions (clicks, input events) rather than mocking framework internals.

**Basic test pattern:**

```tsx
import { expect } from "vitest";
import { createRoot } from "remix/component";

let container = document.createElement("div");
let root = createRoot(container);

root.render(<Counter label="Count" />);
root.flush();

// Initial state
expect(container.textContent).toContain("Count: 0");

// Interact
container.querySelector("button")?.click();
root.flush();

// Updated state
expect(container.textContent).toContain("Count: 1");
```

**Why `root.flush()` is needed:**

- After `root.render()` — so listeners and queued tasks from the initial render are attached
- After user interactions that call `handle.update()` — so the DOM reflects the new state
- After async work resolves if the component uses `handle.queueTask()` — so post-render effects have run

**Cleanup:**

```tsx
root.dispose();
```

Use `root.dispose()` to verify cleanup behavior when relevant (e.g., checking that global listeners are removed, timers are cleared).

**High-value testing patterns:**

- **Minimal component state:** Test the fewest state transitions that prove the behavior
- **Work in event handlers first:** Verify that click/submit/input handlers produce the right DOM changes
- **Use `queueTask` assertions:** When a component uses `handle.queueTask()`, flush and then assert the post-render effect (focus moved, scroll position changed, etc.)
- **Prefer browser or CSS state:** For hover/focus behavior, test the actual focus state on DOM nodes rather than checking CSS classes

**What to avoid:**

- Testing implementation-only markers (data attributes, internal class names) unless they're the only stable assertion point
- Over-mocking framework behavior that can be exercised with real DOM interactions
- Repeating the same navigation assertion across many paths when one representative flow proves the behavior

---

### 33. How do I manage sessions and cookies?

**Decision:** How do I persist user data across requests (sessions, preferences, flash messages)?

**Heuristic:** Use the `session()` middleware to automatically load and save sessions per request. Never manipulate `document.cookie` directly — use Remix's cookie utilities. Always sign session cookies.

**Setting up session middleware:**

```tsx
import { createCookie } from "remix/cookie";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createCookieSessionStorage } from "remix/session/cookie-storage";

// 1. Create a signed cookie (secrets are required)
let sessionCookie = createCookie("__session", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
});

// 2. Choose a storage strategy
let sessionStorage = createCookieSessionStorage();

// 3. Add the middleware to your router
let router = createRouter({
    middleware: [
        // ... other middleware
        session(sessionCookie, sessionStorage),
    ],
});
```

The middleware reads the session from the cookie on each request, makes it available as `context.get(Session)`, and automatically saves changes and sets the response cookie.

**Reading and writing session data in controllers:**

```tsx
router.map(routes.user, {
    actions: {
        // POST
        preferences(context) {
            let session = context.get(Session);
            let { theme } = s.parse(ThemeSchema, context.get(FormData));
            session.set("theme", theme);
            return redirect(routes.user.settings.href());
        },
        // GET
        settings(context) {
            let session = context.get(Session);
            let theme = session.get("theme") ?? "system";
            return frame(<Settings theme={theme} />);
        },
    },
});
```

**Flash messages (persist for one request only):**

```tsx
router.map(routes.contacts, {
    actions: {
        // In the action — set the flash
        async create(context) {
            let contact = await createContact(context.get(FormData));
            let session = context.get(Session);
            session.flash("message", `Created ${contact.name}`);
            return redirect(routes.contacts.show.href({ id: contact.id }));
        },
        // In the next request — read and display it
        async show(context) {
            let session = context.get(Session);
            let flash = session.get("message"); // Available once, then gone
            let contact = await getContact(context.params.id);
            return frame(<ContactDetail contact={contact} flash={flash} />);
        },
    },
});
```

Flash values are available on the next request after they're set, then automatically cleared. This is the standard pattern for success/error notifications after form submissions.

**Storage strategies:**

| Strategy           | Import                         | Best for                                             |
| ------------------ | ------------------------------ | ---------------------------------------------------- |
| Cookie storage     | `remix/session/cookie-storage` | Small session data (< 4KB), no server storage needed |
| Filesystem storage | `remix/session/fs-storage`     | Production servers with persistent disk              |
| Memory storage     | `remix/session/memory-storage` | Development and testing only                         |

**Cookie security:**

- Always provide `secrets` — session cookies must be signed to prevent tampering
- Use `httpOnly: true` to prevent client-side JavaScript access
- Use `secure: true` in production (HTTPS only)
- Use `sameSite: "lax"` to prevent CSRF on cross-site requests

**Secret rotation:** When rotating secrets, add the new secret to the beginning of the array. Existing cookies signed with old secrets can still be parsed, and new cookies will be signed with the new secret:

```tsx
let sessionCookie = createCookie("__session", {
    secrets: [env.NEW_SECRET, env.OLD_SECRET], // New first, old second
});
```

**Session security:** Regenerate the session ID after privilege changes (login, role change) to prevent session fixation attacks:

```tsx
session.regenerateId(); // New ID, keeps data
session.regenerateId(true); // New ID, deletes old session data
```

**Destroying sessions (logout):**

```tsx
session.destroy(); // Clears all data, clears client cookie on next response
```

---

### 34. How do I add authentication?

**Decision:** How do I implement login/logout with session-based auth, and optionally external OAuth providers?

**Heuristic:** Use `remix/auth` for the login flow (verifying credentials or handling OAuth callbacks) and `remix/auth-middleware` for protecting routes on subsequent requests. Auth forms should use standard `<form>` submissions for progressive enhancement — authentication must work without client-side JavaScript.

**The auth middleware stack:**

```tsx
import { auth, createSessionAuthScheme, requireAuth } from "remix/auth-middleware";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";

let router = createRouter({
    middleware: [
        session(sessionCookie, sessionStorage),
        formData(),
        auth({
            schemes: [
                createSessionAuthScheme({
                    // Read the auth record from the session
                    read(session) {
                        return session.get("auth") as { userId: string } | null;
                    },
                    // Verify the record is still valid (look up user)
                    verify(value) {
                        return users.getById(value.userId);
                    },
                    // Clean up on invalidation
                    invalidate(session) {
                        session.unset("auth");
                    },
                }),
            ],
        }),
    ],
});
```

**Credentials login (email/password):**

```tsx
import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from "remix/auth";

let passwordProvider = createCredentialsAuthProvider({
    parse(context) {
        let formData = context.get(FormData);
        let { email, password } = s.parse(AuthSchema, formData);
        return { email, password };
    },
    async verify({ email, password }) {
        return await users.verifyPassword(email, password);
    },
});

router.map(routes.auth.login.action, {
    async handler(context) {
        let user = await verifyCredentials(passwordProvider, context);

        if (user === null) {
            let session = context.get(Session);
            session.flash("error", "Invalid email or password");
            return redirect(routes.auth.login.href());
        }

        // Rotate session ID (prevents session fixation) and write auth record
        let session = completeAuth(context);
        session.set("auth", { userId: user.id });
        return redirect(routes.dashboard.href());
    },
});
```

**The login form (progressive enhancement):**

```tsx
export function LoginForm() {
    return (props: { error?: string }) => (
        <form action={routes.auth.login.action.href()} method={routes.auth.login.action.method}>
            {props.error && <p class="error">{props.error}</p>}
            <label>
                Email
                <input name="email" type="email" required />
            </label>
            <label>
                Password
                <input name="password" type="password" required />
            </label>
            <button type="submit">Log in</button>
        </form>
    );
}
```

This form works with JavaScript disabled — it's a standard HTML POST. No `clientEntry` needed for the basic flow.

**Logout:**

```tsx
router.map(routes.auth.logout, {
    handler({ get }) {
        let session = get(Session);
        session.unset("auth");
        session.regenerateId(true); // Delete old session data
        return redirect(routes.auth.login.href());
    },
});
```

The logout form is also a plain `<form method="POST">` — no JavaScript required:

```tsx
<form action={routes.auth.logout.href()} method={routes.auth.logout.method}>
    <button type="submit">Log out</button>
</form>
```

**Protecting routes:**

```tsx
import { Auth, requireAuth } from "remix/auth-middleware";
import type { GoodAuth } from "remix/auth-middleware";

router.map(routes.dashboard, {
    middleware: [requireAuth()],
    handler(context) {
        let { identity } = context.get(Auth) as GoodAuth<User>;
        return document(<Dashboard user={identity} />);
    },
});
```

`requireAuth()` returns `401 Unauthorized` by default. Customize with `onFailure` to redirect to login or return a frame-aware response:

```tsx
let requireLogin = requireAuth({
    onFailure(context) {
        let isFrame = context.request.headers.get("x-remix-frame") === "true";
        if (isFrame) {
            return frame(<p>Please log in</p>, { status: 401 });
        }
        return redirect(routes.auth.login.href());
    },
});
```

**External auth (OAuth/OIDC — e.g., Google):**

```tsx
import {
    completeAuth,
    createGoogleAuthProvider,
    finishExternalAuth,
    startExternalAuth,
} from "remix/auth";

let googleProvider = createGoogleAuthProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL(routes.auth.google.callback.href(), process.env.APP_ORIGIN),
});

// Start the OAuth redirect
router.map(routes.auth.google.login, {
    handler: context =>
        startExternalAuth(googleProvider, context, {
            returnTo: context.url.searchParams.get("returnTo"),
        }),
});

// Handle the callback
router.map(routes.auth.google.callback, {
    async handler(context) {
        let { result, returnTo } = await finishExternalAuth(googleProvider, context);
        let user = await users.upsertFromGoogle(result.profile);
        let session = completeAuth(context);
        session.set("auth", { userId: user.id });
        return redirect(returnTo ?? routes.dashboard.href());
    },
});
```

**Built-in providers:** Google, Microsoft, Okta, Auth0 (OIDC); GitHub, Facebook, X (OAuth). Create providers at module scope for boot-time validation. For custom OIDC providers, use `createOIDCAuthProvider()`.

**The external auth flow:**

1. Create the provider once at module scope
2. Call `startExternalAuth()` from the login route — redirects to the provider
3. Call `finishExternalAuth()` from the callback route — validates the response
4. Call `completeAuth(context)` to rotate the session ID
5. Write your auth record and redirect

**Multiple auth schemes:** The `auth()` middleware tries each scheme in order. Use this for APIs that accept both session cookies and bearer tokens:

```tsx
import { createBearerTokenAuthScheme, createSessionAuthScheme } from "remix/auth-middleware";

auth({
    schemes: [
        createSessionAuthScheme({
            /* ... */
        }),
        createBearerTokenAuthScheme({
            async verify(token) {
                return apiKeys.validate(token);
            },
        }),
    ],
});
```
