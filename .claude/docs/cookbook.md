# Remix 3, Vite+, & Cloudflare Workers Best Practices Cookbook

A decision-oriented guide for building Remix 3 applications. Each recipe is self-contained: find the decision you're facing, read the heuristic, follow the pattern. This supplements the official API docs in `.claude/docs/remix/` with practical wisdom that isn't obvious from reading API surfaces alone.

## Project Structure

A typical Remix 3 & Vite project:

```
app/
  entry.server.tsx       # Server entry: router, middleware stack, route mapping
  entry.browser.tsx      # Client entry: run(), navigation interception, error banner
  routes.ts              # Route definitions (single source of truth for URLs)
  middleware.ts          # App-defined middleware (e.g. database injection)
  index.css              # Global styles
  actions/               # Route handlers (one file per resource/domain) — created with `createController`
  components/            # UI components (server-only and hydrated)
  data/
    contacts.ts          # Table definition, typed queries, business logic
    schemas.ts           # Data validation schemas (form + search params)
    meta.ts              # Site-wide metadata constants
    adapters/            # Platform-specific database/storage adapters
  utils/
    link.tsx             # `link()` mixin for type-safe frame targeting
    render.tsx           # Server rendering helpers (frame/document responses)
    navigating.ts        # Client navigation state tracking
    metadata/            # `<Head>` component + streaming metadata manager
db/
  migrations/            # Authored migrations — one directory per migration with up.sql / down.sql
  d1-migrations/         # Generated Wrangler-format .sql files (committed)
  apply-d1-migrations.ts # Applies SQL via `wrangler d1 migrations apply`
  generate-d1-migrations.ts # Compiles db/migrations/ → db/d1-migrations/
  seed.ts                # Idempotent local seed script
  lib/                   # Shared helpers for the db scripts
vite.config.ts           # Unified config: build, dev, fmt, lint, typecheck, db tasks
remix.plugin.ts          # Vite plugin for Remix (build, SSR, client entries)
remix-test.config.ts     # `remix test` config (glob patterns, playwright projects)
wrangler.jsonc           # Cloudflare bindings (D1, R2, assets)
```

**Key principle:** Everything runs through `vite.config.ts`. There are no separate config files for linting, formatting, or building. The CLI is `vp` (Vite+).

For small apps with one or two resources, an action file can live at the top level of `app/` (e.g. `app/posts.tsx`). Once you have several, move them into `app/actions/` to keep things organized.

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
export function UserProfile(handle: Handle<{ user: User }>) {
    let props = handle.props;
    return () => (
        <div>
            <h1>{props.user.name}</h1>
            <p>{props.user.bio}</p>
        </div>
    );
}
```

**Hydrated component** (ships JS to client):

```tsx
export let LikeButton = clientEntry(
    import.meta.url,
    (handle: Handle<{ itemId: number; liked: boolean }>) => {
        let submitting = false;
        let liked!: boolean;

        return () => {
            let props = handle.props;
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
    },
);
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
export let EditButton = clientEntry(import.meta.url, (handle: Handle<{ itemId: number }>) => {
    let props = handle.props;
    return () => (
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

**Method override for PUT/PATCH/DELETE:** HTML forms only support GET and POST. For other HTTP methods, use a hidden `_method` field with the `methodOverride()` middleware. Wrap this pattern in a `RestfulForm` component to avoid repeating the boilerplate:

```tsx
import type { RequestMethod } from "remix/router";

export function RestfulForm() {
    return ({
        children,
        method,
        ...props
    }: JSX.IntrinsicHTMLElements["form"] & { method?: RequestMethod | "ANY" }) => {
        let isGET = method === "GET" || typeof method === "undefined";
        return (
            <form method={isGET ? "GET" : "POST"} {...props}>
                {!isGET && <input name="_method" type="hidden" value={method} />}
                {children}
            </form>
        );
    };
}
```

Now any form can use the route's actual HTTP method without manually managing hidden fields:

```tsx
<RestfulForm
    action={routes.contacts.update.href({ id })}
    method={routes.contacts.update.method}
>
    <button type="submit">Save</button>
</RestfulForm>

<RestfulForm
    action={routes.contacts.destroy.href({ id })}
    method={routes.contacts.destroy.method}
>
    <button type="submit">Delete</button>
</RestfulForm>
```

The `methodOverride()` middleware in your server entry reads `_method` from the form data and rewrites the request method before it reaches your controller. Using `routes.*.method` ensures the form always matches the route definition — if you change a route from `PATCH` to `PUT`, the forms update automatically.

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
export let LikeButton = clientEntry(
    import.meta.url,
    (handle: Handle<{ itemId: number; liked: boolean }>) => {
        let submitting = false;
        let liked!: boolean;

        return () => {
            let props = handle.props;
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
    },
);
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
export let SearchBar = clientEntry(import.meta.url, (handle: Handle<{ query?: string }>) => {
    // Re-render when navigation state changes (for loading indicator)
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return () => {
        let props = handle.props;
        let searching = Boolean(navigating.to.url?.searchParams.has("q"));

        return (
            <form method="GET">
                <input
                    defaultValue={props.query ?? undefined}
                    mix={on("input", async event => {
                        try {
                            let url = new URL(location.href);

                            // Clear the param when the input is empty
                            if (!event.currentTarget.value.trim()) {
                                url.searchParams.delete("q");
                                await navigate(url.toString(), { target: "sidebar" });
                                return;
                            }

                            let isFirstSearch = url.searchParams.get("q") === null;

                            url.searchParams.set("q", event.currentTarget.value);
                            await navigate(url.toString(), {
                                target: "sidebar",
                                history: isFirstSearch ? "replace" : "push",
                            });
                        } catch {
                            // Ignore navigation errors caused by abortions during typing
                        }
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

**Why `try/catch` around `navigate`:** When the user types rapidly, each keystroke triggers a new `navigate()` call that aborts the previous one. The aborted navigation rejects with an `AbortError`. Wrapping in `try/catch` prevents these expected errors from surfacing as unhandled rejections.

**Why clear the param separately:** When the search input is emptied, the `q` param is deleted from the URL and the navigation fires immediately without checking `isFirstSearch`. This ensures the sidebar returns to the full contact list without creating unnecessary history entries.

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
navigate(url, { target: "detail" });

// From HTML (type-safe via the link mixin — see Recipe 15):
<a href={url} mix={link({ target: "detail" })}>
    Click me
</a>;
```

**Server-side frame detection:** The server knows which frame is being requested via the `x-remix-target` header. Read it directly from `ctx.headers` in each action — there's no need for a custom middleware or wrapper class:

```tsx
import { getContext } from "remix/middleware/async-context";

async function contactPage(detail: (contact: Contact) => RemixNode) {
    let ctx = getContext();
    let target = ctx.headers.get("x-remix-target");

    if (target === "sidebar") return sidebar(ctx.params.id);

    let contact = await getContact(ctx.params.id);
    if (!contact) throw contact;

    if (target === "detail") return frame(render(detail(contact)));
    return html(await renderDocument(<Document />));
}
```

If you want a typed union of valid frame names, declare it once and use it on the client side (the `link()` mixin in Recipe 15) — the server can stay loose since `x-remix-target` is just a string.

**The two fundamental response types:**

- A **document** response — full HTML page with `<html>`, `<head>`, `<body>`. Used for initial page loads and no-JS fallback. Built with `renderDocument(<Document />)` (returns a stream) and wrapped in `createHtmlResponse as html` from `remix/response/html`.
- A **frame** response — an HTML fragment for a specific frame region. Used when a named frame is targeted. Built with `render(node)` and wrapped in a thin `frame()` helper.

You'll typically build helper functions on top of these for your app's specific layout patterns. For example, a `sidebar()` helper that fetches contacts, parses the current search query, and returns a rendered nav frame — eliminating duplication across every route that needs to update the sidebar.

**Render utilities** (`app/utils/render.tsx`) wire `renderToStream` to the router for in-process frame resolution and provide a small `frame()` constructor:

```tsx
import type { RemixNode } from "remix/ui";

import { router } from "#/entry.server.tsx";
import { renderWithMetadata } from "#/utils/metadata/index.ts";
import { isSafeHtml, type SafeHtml } from "remix/html-template";
import { getContext } from "remix/middleware/async-context";
import { renderToStream } from "remix/ui/server";

export function render(node: RemixNode): ReadableStream<Uint8Array> {
    let context = getContext();
    return renderToStream(node, {
        frameSrc: context.url,
        async resolveFrame(src, target, ctx) {
            let url = new URL(src, ctx?.currentFrameSrc ?? context.url);
            let headers = new Headers({ accept: "text/html" });
            if (target) headers.set("x-remix-target", target);
            let response = await router.fetch(new Request(url, { headers }));
            if (!response.ok) throw new Error(`Failed to resolve frame ${url.pathname}`);
            return response.body ?? (await response.text());
        },
    });
}

export function renderDocument(node: RemixNode): Promise<ReadableStream<Uint8Array>> {
    return renderWithMetadata(render(node));
}

type HtmlBody = string | SafeHtml | Blob | BufferSource | ReadableStream<Uint8Array>;

export function createFrameResponse(body: HtmlBody, init?: ResponseInit): Response {
    if (isSafeHtml(body)) body = String(body);
    return new Response(body, {
        ...(init ? init : {}),
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

export { createFrameResponse as frame };
```

`renderDocument` pipes the rendered stream through `renderWithMetadata` so `<Head>` entries collected from any component (see Recipe 22) get inlined into the document `<head>` before it's flushed.

---

### 6. How do I set up routing?

**Decision:** How should I define my app's URL structure?

**Heuristic:** Define all routes in a single `routes.ts` file. Use the `route()` helper for type-safe, centralized route definitions. Never hardcode URL strings in components or controllers.

**Basic route definition:**

```tsx
import { route, resources, get, patch } from "remix/routes";

export let routes = route({
    home: get("/"),
    uploads: get("/uploads/*key"),
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: patch("/contacts/:id/favorite"),
    },
});
```

**HTTP method helpers:** Use `get()`, `post()`, `put()`, `patch()`, and `del()` to define routes with explicit HTTP methods. This is the preferred style for custom routes — it's shorter and clearer than the `{ method, pattern }` object form.

**What `resources()` generates:** RESTful route patterns following REST conventions. `resources("/contacts")` creates routes for `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy`. Use `exclude` to omit routes you don't need:

```tsx
resources("/contacts", { exclude: ["index", "new"] });
```

**Wildcard parameters:** Use `*name` for catch-all segments. In the example above, `get("/uploads/*key")` matches `/uploads/avatar/123-abc.jpg` with `params.key = "avatar/123-abc.jpg"`.

**Using routes in components (type-safe URL generation):**

```tsx
routes.contacts.show.href({ id: 42 }); // "/contacts/42"
routes.contacts.edit.href({ id: 42 }, { q: "sam" }); // "/contacts/42/edit?q=sam"
routes.home.href(); // "/"
```

**Accessing the HTTP method:** Each route exposes a `.method` property that returns the HTTP method string. Use this with `RestfulForm` (see Recipe 2) to keep forms in sync with route definitions:

```tsx
routes.contacts.update.method; // "PATCH"
routes.contacts.destroy.method; // "DELETE"
routes.contacts.create.method; // "POST"
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

**Heuristic:** Middleware runs in order for every request. Put cheap/broad middleware first, expensive/specific middleware last. Declare the middleware tuple `as const` and feed its type into `RouterTypes` via module augmentation so action handlers see precisely-typed `ctx` properties (e.g. `ctx.formData`, `ctx.get(Database)`).

**Recommended middleware stack:**

```tsx
import contacts from "#/actions/contacts.tsx";
import controller, { uploadHandler } from "#/actions/controller.tsx";
import { database } from "#/middleware.ts";
import { routes } from "#/routes.ts";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type Middleware, type MiddlewareContext } from "remix/router";

function rescueResponses(): Middleware {
    return async (ctx, next) => {
        try {
            return await next();
        } catch (error) {
            if (error instanceof Response) return error;
            throw error;
        }
    };
}

let middleware = [
    rescueResponses(), // 1. Convert thrown Responses into return values
    staticFiles("./public"), // 2. Serve static files (short-circuits)
    staticFiles("./dist/client"), // 3. Serve built client assets
    formData({ uploadHandler }), // 4. Parse form data + file uploads
    methodOverride(), // 5. Rewrite _method field to real HTTP method
    asyncContext(), // 6. Enable request-scoped context (getContext())
    database(), // 7. Initialize database, inject into context
] as const;

declare module "remix/router" {
    interface RouterTypes {
        context: MiddlewareContext<typeof middleware>;
    }
}

export let router = createRouter({ middleware });

router.map(routes, controller);
router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
```

**Why this order matters:**

1. **Rescue first:** `rescueResponses()` wraps the whole pipeline so `throw new Response(...)` from any later middleware or action becomes the outgoing response. This lets `uploadHandler` (and other deep code) signal HTTP failures by throwing a `Response`.
2. **Static files next:** Most requests for CSS/JS/images should return immediately without touching form parsing or database setup.
3. **Form data before method override:** `methodOverride()` reads from the parsed form data, so `formData()` must run first. Pass an `uploadHandler` to `formData()` if your app handles file uploads (see Recipe 35).
4. **Async context before database:** The database middleware uses `context.set()` which requires async context to be active.

**The `RouterTypes` augmentation:** Declaring `interface RouterTypes { context: MiddlewareContext<typeof middleware> }` teaches `remix/router` about everything your stack contributes to the context. Inside actions, `ctx.formData` (from `formData()`), `ctx.params` (typed by the matched route pattern), and `ctx.get(Database)` (from `database()`) all become statically known — no manual typing required.

**HMR support:** The `if (import.meta.hot) ...` block at the bottom lets the dev server pick up server changes without restarting.

---

### 8. Where does my logic belong?

**Decision:** Should this code be in a controller, middleware, component, or utility?

**Heuristic:**

| Logic type                                     | Where it goes                  | Why                                  |
| ---------------------------------------------- | ------------------------------ | ------------------------------------ |
| Request handling for a specific route          | **Actions** (`actions/`)       | Tied to a route's URL/method         |
| Cross-cutting concern (auth, logging, parsing) | **`middleware.ts`**            | Runs across many routes              |
| UI rendering                                   | **Components** (`components/`) | Presentation layer                   |
| Data access / business rules                   | **Data layer** (`data/`)       | Reusable, testable                   |
| Validation schemas                             | **`data/schemas.ts`**          | Shared between actions               |
| Rendering helpers (document, frame)            | **`utils/render.tsx`**         | Shared rendering logic               |
| Link mixin for type-safe frame targeting       | **`utils/link.tsx`**           | Reused on `<a>` and `<button>`       |
| Streaming `<Head>` metadata                    | **`utils/metadata/`**          | SSR + client metadata reconciliation |
| Platform adapters (D1, R2)                     | **`data/adapters/`**           | Swappable implementations            |

**Actions** are grouped per resource and constructed with `createController(route, definition)`. The route argument anchors the type system so each action receives a `ctx` with `ctx.params` matched to the route's pattern and `ctx.formData` typed from the form-data middleware:

```tsx
import { createController } from "remix/router";
import { routes } from "#/routes.ts";

export default createController(routes.posts, {
    actions: {
        async index(ctx) {
            /* ... */
        },
        async show(ctx) {
            /* ... */
        },
        async create(ctx) {
            /* ... */
        },
        async update(ctx) {
            /* ... */
        },
        async destroy(ctx) {
            /* ... */
        },
    },
});
```

`createController` (a) verifies your action names match the route definitions, (b) closes over the route type to type `ctx.params`, and (c) lets the result be passed to `router.map(routes.posts, controller)` without further typing.

**Middleware** is a function that receives `(ctx, next)` and returns a `Response`:

```tsx
import { type Middleware } from "remix/router";

export function database(): Middleware<{ key: typeof Database; value: Database }> {
    let adapter = new D1DatabaseAdapter(env.DB);
    let db = new Database(adapter);
    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
```

Call `next()` to pass through to the next middleware or the matched route handler. The `Middleware<...>` generic declares what the middleware adds to the context — when combined with the `RouterTypes` augmentation (Recipe 7), this makes `ctx.get(Database)` statically typed in every action.

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

**Parsing in actions:**

```tsx
// Parse search params (URLSearchParams)
let { q } = s.parse(SearchSchema, ctx.url.searchParams);

// Parse form data (FormData from request body)
// `ctx.formData` is contributed by the `formData()` middleware (see Recipe 7)
// and typed via the RouterTypes augmentation.
let { enabled } = s.parse(ToggleSchema, ctx.formData);
let profile = s.parse(ProfileSchema, ctx.formData);
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
// utils/navigating.ts - a singleton
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
import { createMetadataManager, withMetadataFrames } from "#/utils/metadata/index.ts";
import { createRoot, navigate, on, run } from "remix/ui";

// Hydrate the streaming-metadata manager. It reads <template
// data-pitlane-metadata> nodes flushed during SSR and applies them
// to document.head, then keeps the head reconciled with future
// frame updates (see Recipe 22).
createMetadataManager().hydrate(document);

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

    // Form POST submission — out-of-band so the URL only changes on success
    if (event.formData) {
        event.preventDefault();

        let { destination, formData } = event;

        void (async () => {
            let response = await fetch(destination.url, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let body = (await response.text()).trim();
                let message = body || `${response.status} ${response.statusText}`;
                let error = Object.assign(new Error(message), { status: response.status });
                app.dispatchEvent(new ErrorEvent("error", { error, message }));
                return;
            }

            navigate(response.url, { target, src, resetScroll });
        })();
        return;
    }

    // Form GET submission
    event.preventDefault();
    navigate(event.destination.url, { target, src, resetScroll });
});

// Phase 2: Remix runtime
let app = run({
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
    // withMetadataFrames wraps resolveFrame so any <template data-pitlane-metadata>
    // payload arriving with a frame response gets handed to the metadata manager
    // before the frame's body is committed.
    resolveFrame: withMetadataFrames(async (src, signal, target) => {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        let response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    }),
});

// Global error boundary — renders a dismissible banner for any error
// dispatched on the app runtime, including failed POST submissions above.
let bannerHost = document.createElement("div");
document.body.insertBefore(bannerHost, document.body.firstChild);
let bannerRoot = createRoot(bannerHost);

function ErrorBanner(handle: Handle<{ message: string }>) {
    let props = handle.props;
    return () => (
        <div id="app-error-banner" role="alert">
            <p>{props.message}</p>
            <button
                aria-label="Dismiss"
                mix={on("click", () => bannerRoot.render(null))}
                type="button"
            >
                ×
            </button>
        </div>
    );
}

app.addEventListener("error", event => {
    let message = event.message || String(event.error) || "Something went wrong.";
    bannerRoot.render(<ErrorBanner message={message} />);
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
2. **Phase 2 (`run`):** Initializes the Remix runtime — module loading for hydrated components and frame resolution for fetching frame content. The returned `app` event target is the runtime's error bus.
3. **Phase 3 (after `run`):** Sets `focusReset: "manual"` for all non-traverse navigations. Registered last so its `intercept()` call wins, preventing the browser from resetting focus to the top of the page during frame updates.

**Why out-of-band POST fetch:** Driving POSTs through `event.intercept({ handler })` ties the navigation URL to the request lifecycle — the URL bar can flip to the action URL even when the server returns an error. Doing the fetch outside `intercept` lets the URL stay put on failure; only the `navigate(response.url, ...)` call (after a successful response) commits the new URL. Errors are dispatched to `app` and rendered as a dismissible banner.

**Why `event.sourceElement`:** For form submissions triggered by a submit button, `event.sourceElement` is that `<button>`. This is how `rmx-*` attributes on form buttons work — the listener reads them directly from the submitting element and passes them to `navigate()`.

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

**Using built-in context keys:** Some packages export pre-defined context keys. For example, `remix/data-table` exports a `Database` key:

```tsx
import { Database } from "remix/data-table";
```

**Set it in middleware** (`app/middleware.ts`):

```tsx
import { D1DatabaseAdapter } from "#/data/adapters/d1-data-table.ts";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/router";

type DatabaseEntry = { key: typeof Database; value: Database };

export function database(): Middleware<DatabaseEntry> {
    let adapter = new D1DatabaseAdapter(env.DB);
    let db = new Database(adapter);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
```

The `Middleware<DatabaseEntry>` generic tells `remix/router` what this middleware adds to the context. When combined with the `RouterTypes` augmentation in Recipe 7, `ctx.get(Database)` becomes typed in every action.

**Define custom context keys** when no built-in key exists:

```tsx
import { createContextKey } from "remix/router";
export let MyService = createContextKey<MyServiceType>();
```

**Read it in actions or utilities:**

```tsx
// In an action:
let db = ctx.get(Database);

// In a utility function (via async context):
import { getContext } from "remix/middleware/async-context";
let db = getContext().get(Database);
```

The `asyncContext()` middleware makes the request context available anywhere via `getContext()` without threading it through function arguments. This is especially useful in data access functions that are called from actions but don't directly receive the request context.

---

### 14. How do I compose the component factory pattern?

**Decision:** Why do components return functions, and how does this affect composition?

**Heuristic:** Every Remix 3 component is a factory -- a function that returns a render function. The outer function is the "setup" phase (runs once); the inner function is the "render" phase (runs on every update).

**Server-only component:**

```tsx
export function UserCard(handle: Handle<{ user: User }>) {
    // Setup: runs once per render on the server
    let props = handle.props;
    return () => (
        // Render: the actual JSX
        <div>{props.user.name}</div>
    );
}
```

For server-only components, the setup phase is minimal -- there's no persistent state. But the factory pattern is still required.

**Hydrated component:**

```tsx
export let SearchInput = clientEntry(import.meta.url, (handle: Handle<{ query?: string }>) => {
    // Setup: runs once on hydration
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return () => {
        let props = handle.props;
        // Render: runs on every update
        let searching = Boolean(navigating.to.url?.searchParams.has("q"));
        return <input defaultValue={props.query} />;
    };
});
```

**Composing components:** Use standard JSX composition. Server-only components can contain hydrated components (creating islands of interactivity):

```tsx
export function ItemDetail(handle: Handle<{ item: Item }>) {
    let props = handle.props;
    return () => (
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

### 15. How do I target a specific frame from links and forms?

**Decision:** How do I make a link or form button update a specific frame instead of the whole page?

**Heuristic:** Use the `link()` mixin from `app/utils/link.tsx`. It's a thin wrapper around `createMixin` that accepts a `LinkProps` object and renders `rmx-*` attributes that the client entry (Recipe 11) and the built-in Remix anchor listener pick up. The reason it exists (instead of using the built-in `link()` from `remix/ui`) is to support both `<a>` and `<button type="submit">` elements — the latter is the form-submit pathway that drives frame-targeted POSTs.

**On links:**

```tsx
import { link } from "#/utils/link.tsx";

<a href={routes.contacts.show.href({ id: contact.id })} mix={link({ target: "detail" })}>
    {contact.first} {contact.last}
</a>;
```

**On form buttons:**

```tsx
<RestfulForm
    action={routes.contacts.edit.href({ id: contact.id })}
    method={routes.contacts.edit.method}
>
    <button mix={link({ target: "detail" })} type="submit">
        Edit
    </button>
</RestfulForm>
```

For form submissions, the client entry's navigate listener reads the resulting `rmx-*` attributes from `event.sourceElement` — the submit button, not the `<form>`. This means a server-only form can target a specific frame without hydration.

**The `link` mixin definition:**

```tsx
import { createMixin } from "remix/ui";

export type LinkProps = { target?: string; src?: URL; resetScroll?: boolean };

// Only created instead of `remix/ui.link()` to support button elements
// for our custom form submission handling as well as anchor elements
export let link = createMixin<HTMLAnchorElement | HTMLButtonElement, [LinkProps]>(handle => {
    return props => (
        <handle.element
            rmx-reset-scroll={props.resetScroll != null ? `${props.resetScroll}` : undefined}
            rmx-src={props.src?.toString()}
            rmx-target={props.target}
        />
    );
});
```

The mixin renders `rmx-*` attributes onto the host element.

**Tightening the `target` type:** If you want compile-time validation of frame names, narrow `LinkProps["target"]` to a union literal (e.g. `"sidebar" | "detail"`). The server reads `ctx.headers.get("x-remix-target")` as a plain string (Recipe 5), so the typing is purely a client-side ergonomic choice.

**Available props:**

| Prop          | Type      | Purpose                               |
| ------------- | --------- | ------------------------------------- |
| `target`      | `string`  | Target a named frame                  |
| `src`         | `URL`     | Override the frame content source URL |
| `resetScroll` | `boolean` | Reset scroll position on frame update |

These are the declarative equivalents of the options you can pass to `navigate()`:

```tsx
navigate(url, { target: "detail", src: someUrl, resetScroll: true });
```

**Use the `link()` mixin for links and form buttons. Use `navigate()` with options for programmatic navigation.** They produce the same `rmx-*` attributes under the hood, but the mixin gives you type safety for frame names.

---

### 16. How do I handle the full-page vs. frame response decision?

**Decision:** My controller handles the same route for initial loads and frame updates. How do I return the right response?

**Heuristic:** Read `ctx.headers.get("x-remix-target")` (see Recipe 5) to determine which frame is being requested. Each action should handle all three cases: sidebar-only updates, detail-only updates, and full-page loads.

```tsx
import { getContext } from "remix/middleware/async-context";
import { createHtmlResponse as html } from "remix/response/html";
import { redirect } from "remix/response/redirect";
import { frame, render, renderDocument } from "#/utils/render.tsx";

async function contactPage(detail: (contact: Contact) => RemixNode) {
    try {
        let ctx = getContext();
        let target = ctx.headers.get("x-remix-target");
        let { id } = s.parse(IdSchema, ctx.params);

        if (target === "sidebar") {
            return sidebar(id);
        } else {
            let contact = await getContact(id);
            if (!contact) throw contact;

            if (target === "detail") {
                return frame(render(detail(contact)));
            }

            return html(await renderDocument(<Document />));
        }
    } catch {
        return redirect(routes.home.href());
    }
}
```

This helper accepts a render function for the detail frame and handles all three cases. Actions become one-liners:

```tsx
async show(ctx) {
    let { q } = s.parse(QuerySchema, ctx.url.searchParams);
    return await contactPage(contact => <ShowContact contact={contact} query={q} />);
},
async edit() {
    return await contactPage(contact => <EditContact contact={contact} />);
},
```

**Why this pattern matters:** The same URL serves different content depending on context:

- **Initial page load:** Returns a full HTML document with all frames resolved inline
- **Frame navigation:** Returns just the targeted frame's HTML fragment
- **No JavaScript:** Falls back to full document -- progressive enhancement still works

**Extract this into a reusable helper** when multiple routes share the same layout. The `try/catch` wrapper provides a single place to handle missing records -- redirecting to the home page rather than showing an error.

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

**Migrations:** When deploying to Cloudflare D1, author migrations as TypeScript under `db/migrations/` using `remix/data-table/migrations`, then compile them to deterministic `.sql` files in `db/d1-migrations/` (committed to git). Cloudflare's own `wrangler d1 migrations apply` consumes the generated SQL — both `--local` and `--remote` use the same files, so there is no TypeScript-only path against the dev database.

```tsx
// db/migrations/20260213161402_create_posts.ts
import { Posts } from "#/data/posts.ts";
import { createMigration } from "remix/data-table/migrations";

export default createMigration({
    async up({ schema }) {
        await schema.createTable(Posts, { ifNotExists: true });
        await schema.createIndex(Posts, ["title", "createdAt"], { ifNotExists: true });
    },
    async down({ schema }) {
        await schema.dropTable(Posts, { ifExists: true });
    },
});
```

> **D1 constraint:** Migrations MUST use only `schema.*` (DDL) operations. Anything that calls `db.*` data operations cannot be dry-run to SQL — put that logic in a standalone seed script (see "Seed data" below).

**Compiling to SQL** — a helper script reads each TS migration via `loadMigrations` and writes one `.sql` file per migration:

```tsx
// db/generate-d1-migrations.ts (simplified)
import path from "node:path";
import { loadMigrations } from "remix/data-table/migrations/node";
import {
    buildSqlFileContents,
    d1MigrationFilename,
    normalizeSqlStatements,
} from "./lib/sql-generation.ts";

let migrations = await loadMigrations(path.resolve("db/migrations"));
for (let migration of migrations) {
    let statements = normalizeSqlStatements(migration.up);
    let contents = buildSqlFileContents({
        sourceFilename: `${migration.id}_${migration.name}/up.sql`,
        statements,
    });
    let outFile = path.join(
        "db/d1-migrations",
        d1MigrationFilename({ id: migration.id, name: migration.name }),
    );
    writeFileSync(outFile, contents, "utf-8");
}
```

`schema.createTable()` reads column definitions directly from the `table()` call, so you never write raw SQL for table creation. `schema.createIndex()` takes the table and an array of column names. Use `{ ifNotExists: true }` / `{ ifExists: true }` for idempotent migrations.

**Seed data** lives in a separate standalone script (`db/seed.ts`), not a migration. It connects to D1 via Wrangler's `getPlatformProxy` and inserts rows directly:

```tsx
// db/seed.ts
import { D1DatabaseAdapter } from "#/data/adapters/d1-data-table.ts";
import { Posts } from "#/data/posts.ts";
import { Database } from "remix/data-table";
import { getPlatformProxy } from "wrangler";

let proxy = await getPlatformProxy<Env>({ configPath: "./wrangler.jsonc", persist: true });

try {
    let db = new Database(new D1DatabaseAdapter(proxy.env.DB));

    let count = await db.count(Posts);
    if (count > 0) {
        console.log(`Seed skipped: ${count} row(s) already present.`);
        process.exit(0);
    }

    for (let post of SEED_POSTS) {
        await db.create(Posts, post);
    }
} finally {
    await proxy.dispose();
    process.exit(0);
}
```

The seed runs only against local D1 (via `getPlatformProxy`) — production starts empty.

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

**Heuristic:** Use migration files — one per schema change, timestamped and ordered. Each migration has an `up` (apply) and `down` (revert) function. On Cloudflare D1, compile them to `.sql` and let Wrangler's `d1 migrations apply` track which have run via its built-in `d1_migrations` journal table.

**Project structure:**

```
db/
  migrations/                                # Source TS migrations
    20260228090000_create_posts.ts
    20260315140000_add_published_at.ts
    20260320100000_add_tags.ts
  d1-migrations/                             # Generated .sql (committed)
    20260228090000_create_posts.sql
    20260315140000_add_published_at.sql
    20260320100000_add_tags.sql
  generate-d1-migrations.ts                  # TS → SQL compiler
  apply-d1-migrations.ts                     # Shells out to `wrangler d1 migrations apply`
  seed.ts                                    # Standalone seed script
  lib/                                       # Shared helpers
```

Name each TS file as `YYYYMMDDHHmmss_name.ts`. The `id` and `name` are inferred from the filename. Each file default-exports a `createMigration(...)`.

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

**The two-step Cloudflare D1 workflow:**

1. **Generate** — `vp run db:migrations:generate` runs each TS migration through the data-table runner in `dryRun: true` mode and writes one deterministic `.sql` file per source migration into `db/d1-migrations/`. These files are committed to git.
2. **Apply** — `vp run db:migrations:apply:local` (or `:remote`) shells out to `wrangler d1 migrations apply DB --local` (or `--remote`), which reads `db/d1-migrations/` and uses Wrangler's own `d1_migrations` journal table on the target database.

The apply helper is a thin wrapper around `wrangler`:

```tsx
// db/apply-d1-migrations.ts (simplified)
import { parseArgs } from "node:util";
import { buildApplyCommand, runApplyCommand } from "./lib/wrangler-cli.ts";
import { parseWranglerConfig } from "./lib/wrangler-config.ts";

let { values } = parseArgs({
    options: {
        local: { type: "boolean", default: false },
        remote: { type: "boolean", default: false },
    },
});
let target: "local" | "remote" = values.local ? "local" : "remote";

let config = parseWranglerConfig();
let cmd = buildApplyCommand({
    d1Binding: config.d1.binding,
    target,
    configPath: config.configPath,
});

let { stdout, stderr } = await runApplyCommand(cmd);
process.stdout.write(stdout);
process.stderr.write(stderr);
```

The `--remote` target needs `CLOUDFLARE_API_TOKEN` (or `CLOUDFLARE_API_KEY`) in the environment.

**Wiring it into Vite+ tasks** (`vite.config.ts`):

```ts
run: {
    tasks: {
        "db:migrations:generate": {
            command: "node db/generate-d1-migrations.ts",
            cache: false,
        },
        "db:migrations:apply:local": {
            dependsOn: ["db:migrations:generate"],
            command: "node db/apply-d1-migrations.ts --local",
            cache: false,
        },
        "db:migrations:apply:remote": {
            command: "node db/apply-d1-migrations.ts --remote",
            cache: false,
        },
        "db:migrations:deploy": {
            dependsOn: ["db:migrations:generate"],
            command: "node db/apply-d1-migrations.ts --remote",
            cache: false,
        },
        "db:seed": {
            dependsOn: ["db:migrations:apply:local"],
            command: "node db/seed.ts",
        },
        "db:reset": {
            command: "rm -rf .wrangler/state/v3/d1",
        },
    },
},
```

This makes `vp dev` (which `dependsOn: ["typegen", "db:seed"]`) idempotently regenerate SQL, apply migrations locally, and seed demo rows before starting the server.

**`wrangler.jsonc` setup:** Point `migrations_dir` at `db/d1-migrations/` (relative to the wrangler config file):

```jsonc
"d1_databases": [
    {
        "binding": "DB",
        "database_name": "my-db",
        "database_id": "local",
        // Generated by `vp db:migrations:generate` from db/migrations/*.ts.
        "migrations_dir": "./db/d1-migrations"
    }
]
```

**The development workflow:**

When you need to change your schema, you update three things together in the same commit:

1. **Update the `table()` definition** in your source code to reflect the desired schema (e.g., add the new column to the `columns` object).
2. **Write a TS migration** in `db/migrations/` that transitions the database (e.g., `schema.alterTable` with `table.addColumn`).
3. **Regenerate `db/d1-migrations/`** by running `vp run db:migrations:generate` and commit the resulting `.sql` file alongside the source.

The `table()` definition is the source of truth for what the schema looks like _now_. The TS migration describes _how to get there_. The committed `.sql` is the artifact Wrangler actually applies — keeping it under source control means CI/CD doesn't need to compile TS at deploy time, and `--local` and `--remote` are guaranteed to apply byte-identical SQL.

**At deploy time**, apply migrations before the worker takes traffic:

```sh
vp run db:migrations:deploy && wrangler deploy
```

Wrangler's `d1_migrations` journal table tracks which migrations have already been applied, so this is always safe — it only applies new ones.

**Key principles:**

- **One migration per change:** Each migration should do one logical thing (add a column, create a table, backfill data). This keeps rollbacks predictable.
- **Migrations are append-only:** Never edit a migration that has already been applied in production. Write a new migration instead.
- **Table definition and migration in the same commit:** The `table()` definition describes the _current_ state; the migration describes the _transition_. Shipping them together guarantees the code and database stay in sync.
- **Use `dryRun` in CI:** Review generated SQL before deploying to catch dialect-specific issues.

---

### 19. How do I handle redirects after mutations?

**Decision:** What should happen after a create/update/delete?

**Heuristic:** Follow the Post/Redirect/Get pattern. After every mutation, redirect to the appropriate page. Import `redirect` from `remix/response/redirect`:

```tsx
import { redirect } from "remix/response/redirect";

// After create: redirect to the edit page for the new record
async create() {
    let id = await createPost();
    return redirect(routes.posts.edit.href({ id }));
}

// After update: redirect to the show page
async update(ctx) {
    let data = s.parse(PostSchema, ctx.formData);
    let { id } = s.parse(IdSchema, ctx.params);
    await updatePost(id, data);
    return redirect(routes.posts.show.href({ id }));
}

// After delete: redirect to the index or home
async destroy(ctx) {
    let { id } = s.parse(IdSchema, ctx.params);
    await deletePost(id);
    return redirect(routes.posts.index.href());
}
```

**Why PRG matters:** It prevents duplicate submissions on refresh and ensures the browser's back button works correctly.

**For non-navigating mutations** (like toggling a boolean field), return data instead of redirecting:

```tsx
async toggle(ctx) {
    let { enabled } = s.parse(ToggleSchema, ctx.formData);
    let { id } = s.parse(IdSchema, ctx.params);
    let updated = await updateItem(id, { enabled });
    return Response.json(updated);
}
```

The client handles the state update optimistically and doesn't need a redirect.

---

### 20. How do I configure Vite+ for a Remix project?

**Decision:** What does my `vite.config.ts` need?

**Heuristic:** Keep it minimal. The Remix plugin handles most of the build configuration. When deploying to Cloudflare Workers, add the `@cloudflare/vite-plugin` to handle Workers-specific bundling and binding injection.

```tsx
import { cloudflare } from "@cloudflare/vite-plugin";
import devtoolsJson from "vite-plugin-devtools-json";
import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [
        remix({ serverHandler: false }),
        cloudflare({ viteEnvironment: { name: "ssr" } }),
        devtoolsJson(),
    ],
    server: { port: 1612 },
    css: { transformer: "lightningcss" },
    run: {
        tasks: {
            dev: {
                dependsOn: ["typegen", "db:seed"],
                command: "vp dev --host",
            },
            "db:seed": {
                dependsOn: ["db:migrations:apply:local"],
                command: "node db/seed.ts",
            },
            "db:reset": { command: "rm -rf .wrangler/state/v3/d1" },
            "db:migrations:generate": {
                command: "node db/generate-d1-migrations.ts",
                cache: false,
            },
            "db:migrations:apply:local": {
                dependsOn: ["db:migrations:generate"],
                command: "node db/apply-d1-migrations.ts --local",
                cache: false,
            },
            "db:migrations:apply:remote": {
                command: "node db/apply-d1-migrations.ts --remote",
                cache: false,
            },
            "db:migrations:deploy": {
                dependsOn: ["db:migrations:generate"],
                command: "node db/apply-d1-migrations.ts --remote",
                cache: false,
            },
            typegen: {
                input: ["wrangler.jsonc"],
                command: "wrangler types",
            },
            typecheck: {
                dependsOn: ["typegen"],
                command: "tsc --noEmit",
                cache: false,
            },
            check: {
                dependsOn: ["typegen"],
                command: "vp check --fix",
                cache: false,
            },
            test: { command: "remix test" },
            deploy: { command: "wrangler deploy", cache: false },
        },
    },
    fmt: {
        /* Oxfmt options */
    },
    lint: {
        /* Oxlint options */
    },
});
```

**Plugin configuration:**

- `remix({ serverHandler: false })` — Disables the Remix plugin's built-in Node.js server handler since Cloudflare Workers provides its own. Without this flag, the plugin creates a Node.js request listener that isn't compatible with Workers.
- `cloudflare({ viteEnvironment: { name: "ssr" } })` — Tells the Cloudflare Vite plugin which build environment contains the server entry. This plugin handles Workers-specific bundling, injects platform bindings (D1, R2, etc.) during dev, and produces a deployable worker bundle.

**Run tasks:** The `run.tasks` config defines orchestrated commands that `vp run <task>` executes. Key patterns:

- **`dependsOn`:** Ensures prerequisites run first. `dev` chains `typegen` (generates `Env` types from `wrangler.jsonc`) and `db:seed` (which itself chains `db:migrations:apply:local` → `db:migrations:generate`).
- **`input`:** File-based cache invalidation. `typegen` only reruns when `wrangler.jsonc` changes.
- **`cache: false`:** Disables caching for tasks that should always run (typecheck, deploy, migrations).
- **`db:reset`:** Deletes local D1 state for a clean slate during development.
- **`test`:** Runs the in-tree `remix test` runner (see Recipe 32) against `remix-test.config.ts`.

**What the `remix()` plugin provides:**

- **Build orchestration:** Builds SSR then client environments, with separate output directories (`dist/ssr`, `dist/client`)
- **Preview server:** Loads the built SSR entry and creates a request listener for `vp preview`
- **Client entry transforms:** Automatically resolves `import.meta.url` in `clientEntry()` calls to the correct asset URLs for both server and client environments
- **Error suppression:** Prevents abort errors from cancelled requests (e.g., search-as-you-type) from triggering the Vite error overlay

**Commands:**

- `vp dev` — start dev server with HMR (runs typegen + migrations + seed first)
- `vp build` — production build
- `vp preview` — preview production build locally
- `vp check` — format + lint + typecheck in one pass
- `vp run test` — run the `remix test` suite
- `vp run db:migrations:deploy` — generate SQL + apply to remote D1
- `vp run deploy` — deploy to Cloudflare Workers
- `vp run db:reset` — wipe local D1 database

---

### 21. How do I derive active/pending state for navigation items?

**Decision:** How does a list item know if it's currently active or being navigated to?

**Heuristic:** Use route pattern matching against the current URL (for active) and the navigation destination URL (for pending). This is necessary because frame-targeted navigations only update one frame -- components in other frames don't re-render, so server-provided props become stale.

```tsx
import { createMultiMatcher } from "remix/route-pattern/match";

// Set up a matcher for the routes this item could match
let matcher = createMultiMatcher<true>();
matcher.add(routes.posts.show.pattern, true);
matcher.add(routes.posts.edit.pattern, true);

// In the render function:
let currentMatch = !isServer ? matcher.match(location.href) : null;
let isActive = Number(currentMatch?.params?.id ?? selected) === item.id;

// Pending: destination matches this item but isn't the current page
let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
let isPathChange = !isServer && navigating.to.url?.pathname !== location.pathname;
let isPending = !isActive && isPathChange && Number(destination?.params.id) === item.id;
```

**Why derive from URL instead of props:** Frame-targeted navigations don't re-render components outside the targeted frame. A server-provided `selected` prop becomes stale after client-side navigation. Reading `window.location.href` directly gives the true current state.

**The `selected` prop serves as a server fallback** for the initial render and non-JS environments. On the client, the URL-derived state takes precedence.

---

### 22. How do I update head metadata during frame navigations?

**Decision:** How do I change `<title>`, `<meta>`, `<link>`, and other head elements when frame content changes without a full page load?

**Heuristic:** Use the `<Head>` component from `app/utils/metadata/`. It lets frame components declare head entries in their JSX; the server inlines them into `document.head` at SSR time, and a hydrated `MetadataManager` reconciles them across subsequent frame navigations. This handles `<title>`, `<meta>`, `<link>`, `<style>`, and `<script>` uniformly — no per-element components required.

**The pieces:**

```
app/utils/metadata/
  index.ts        # public API surface
  head.tsx        # <Head> component (collects + transports entries)
  manager.ts      # MetadataManager (client reconciliation)
  rules.ts        # precedence / dedupe / lifecycle rules
  html.ts         # HTML rendering of head entries
  ssr.ts          # injects collected entries into the document
  stream.ts       # streaming integration (renderWithMetadata)
  transport.ts    # serializes entries into <template data-pitlane-metadata>
  frames.ts       # withMetadataFrames wrapper for resolveFrame
```

**Usage in any component** (server-only or hydrated):

```tsx
import { Head } from "#/utils/metadata/index.ts";

export function PostDetail(handle: Handle<{ post: Post }>) {
    let props = handle.props;
    return () => (
        <div>
            <Head>
                <title>{`${props.post.title} · ${SITE.title}`}</title>
                {props.post.summary ? (
                    <meta content={props.post.summary} name="description" />
                ) : null}
            </Head>
            <h1>{props.post.title}</h1>
        </div>
    );
}
```

`<Head>` accepts any combination of `<title>`, `<meta>`, `<link>`, `<style>`, and `<script>` children. They never render in place — the component emits a `<template data-pitlane-metadata>` placeholder that the rest of the pipeline reads.

**How the pieces fit together:**

1. **Server render:** `<Head>` writes a transport `<template>` into the stream. `renderDocument()` pipes the rendered stream through `renderWithMetadata` (`stream.ts`), which collects all transport templates and injects their entries into `document.head` (via `ssr.ts`) before the response is flushed. So the initial HTML arrives with a fully-populated `<head>` — no flash, no script.

2. **Client hydration:** `entry.browser.tsx` calls `createMetadataManager().hydrate(document)` before `run()`. The manager indexes head entries by precedence and owner so it can later remove or replace them.

3. **Frame navigation:** The client entry passes its `resolveFrame` through `withMetadataFrames(...)`. When a frame response contains `<template data-pitlane-metadata>` payloads, the wrapper extracts them and hands them to the manager, which reconciles `<head>` against the new entries before committing the frame body.

**Why a transport layer:** A naive "set `document.title` on render" approach can only update the title. The metadata module handles arbitrary head elements with precedence rules — multiple frames can each contribute `<meta>` tags, and the manager dedupes by key and unloads entries whose owner frame disappears.

**Per-page baseline:** The base `<title>` and shared meta tags belong in `Document.tsx` inside `<Head>`. Frame components add or override entries from there. The "owner" of an entry is inferred from where `<Head>` lives (page, frame, leaf component) — see [head.tsx:104](app/utils/metadata/head.tsx#L104).

---

### 23. How do asset imports work in the document shell?

**Decision:** How do I wire up scripts, stylesheets, and preload links in my HTML document?

**Heuristic:** Use Vite's asset import specifiers to resolve paths at build time. Never hardcode asset paths in components.

**The three import types:**

```tsx
// Client entry module — resolves hydration script + its dependencies
import clientAssets from "#/entry.browser.ts?assets=client";

// SSR assets — resolves server-rendered module dependencies (CSS, JS preloads)
import serverAssets from "#/entry.server.tsx?assets=ssr";

// Standalone stylesheet — resolves to a URL string
import styles from "#/index.css?url";
```

**Merging assets in the document shell:**

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
import styles from "#/index.css?url";

// In your document shell:
<link href={styles} rel="stylesheet" />;
```

**The `css()` mixin for component-scoped rules:**

```tsx
import { css } from "remix/ui";

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
import { ref } from "remix/ui";

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
import { animateEntrance } from "remix/ui/animation";

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
import { animateEntrance, animateExit } from "remix/ui/animation";

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
import { animateLayout, spring } from "remix/ui/animation";

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

**Heuristic:** Use the built-in interaction helpers from `remix/ui` instead of writing your own keyboard/pointer normalization. For frame-targeted navigation on anchors and buttons, use the `link()` mixin (see Recipe 15) — it provides type-safe frame names.

**`keysEvents()` — key-specific host events:**

```tsx
import { keysEvents } from "remix/ui";

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
import { pressEvents } from "remix/ui";

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

**`link()` — frame targeting on anchors and buttons:**

The `link()` mixin (defined in `app/utils/link.tsx` — see Recipe 15) is the standard way to target frames from `<a>` and `<button>` elements:

```tsx
import { link } from "#/utils/link.tsx";

<a href={routes.contacts.show.href({ id })} mix={link({ target: "detail" })}>
    View
</a>;
```

Prefer real `<a>` tags and `<form><button type="submit"></button></form>` tags with the `link()` mixin — they're accessible and work without JavaScript. The generic `link()` from `remix/ui` can make any element behave like a navigation link, but reserve that for cases where an anchor or button tag isn't practical (e.g., a complex interactive card that needs to navigate on click).

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
import { createMixin } from "remix/ui";

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
import iconsHref from "#/icons.svg?url";
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

**Heuristic:** Use the built-in `remix test` runner from `remix/test`. It provides `describe`/`it`, hooks, and runs both server-side unit tests and in-browser component tests via Playwright. For component DOM tests, import `render` from `remix/ui/test` (or assert directly against `document` for tests written against the browser pool).

**Configuration** — `remix-test.config.ts`:

```ts
import type { RemixTestConfig } from "remix/test";

export default {
    glob: {
        test: "app/**/*.test.{ts,tsx}",
        browser: "app/**/*.test.{ts,tsx}",
    },
    playwrightConfig: {
        projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    },
} satisfies RemixTestConfig;
```

Wire it into a Vite+ task so `vp run test` invokes the runner:

```ts
test: { command: "remix test" },
```

**Basic server-side test:**

```ts
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { entriesFromHeadChildren } from "./head.tsx";

describe("entriesFromHeadChildren", () => {
    it("collects title and meta entries in order", () => {
        let entries = entriesFromHeadChildren(
            <>
                <title>Hello</title>
                <meta content="x" name="description" />
            </>,
        );
        assert.equal(entries[0].type, "title");
        assert.equal(entries[1].type, "meta");
    });
});
```

**Browser/component test** — use a real `document` from the browser runner. Mount markup via DOM APIs rather than direct property writes:

```tsx
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MetadataManager } from "./manager.ts";
import { createTransportHtml } from "./transport.ts";

function setDocument(html: string) {
    let parser = new DOMParser();
    let parsed = parser.parseFromString(`<!DOCTYPE html><html>${html}</html>`, "text/html");
    document.head.replaceChildren(...Array.from(parsed.head.childNodes));
    document.body.replaceChildren(...Array.from(parsed.body.childNodes));
}

describe("MetadataManager", () => {
    it("hydrates templates into document.head", () => {
        setDocument(
            `<head></head><body>${createTransportHtml({
                owner: "page",
                entries: [{ type: "title", props: {}, children: "Page" }],
            })}</body>`,
        );

        let manager = new MetadataManager();
        manager.hydrate(document);

        assert.equal(document.head.querySelector("title")?.textContent, "Page");
        manager.dispose();
    });
});
```

**High-value testing patterns:**

- **Server-renderable behavior first:** Pure logic (schema parsing, rendering helpers, route matchers) tests cleanly without a DOM — keep it in the `test` glob.
- **Browser tests for DOM commit semantics:** Anything that depends on the manager, `handle.queueTask`, focus, or event dispatch belongs in the `browser` glob.
- **Use `remix/assert`:** Avoid external matchers — the built-in `assert.equal`/`assert.deepEqual` keep the test surface tight and match what's used across the project's own tests.

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
import { session } from "remix/middleware/session";
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

**Reading and writing session data in actions:**

```tsx
router.map(
    routes.user,
    createController(routes.user, {
        actions: {
            // POST
            preferences(ctx) {
                let session = ctx.get(Session);
                let { theme } = s.parse(ThemeSchema, ctx.formData);
                session.set("theme", theme);
                return redirect(routes.user.settings.href());
            },
            // GET
            settings(ctx) {
                let session = ctx.get(Session);
                let theme = session.get("theme") ?? "system";
                return frame(render(<Settings theme={theme} />));
            },
        },
    }),
);
```

**Flash messages (persist for one request only):**

```tsx
router.map(
    routes.contacts,
    createController(routes.contacts, {
        actions: {
            // In the action — set the flash
            async create(ctx) {
                let contact = await createContact(ctx.formData);
                let session = ctx.get(Session);
                session.flash("message", `Created ${contact.name}`);
                return redirect(routes.contacts.show.href({ id: contact.id }));
            },
            // In the next request — read and display it
            async show(ctx) {
                let session = ctx.get(Session);
                let flash = session.get("message"); // Available once, then gone
                let contact = await getContact(Number(ctx.params.id));
                return frame(render(<ContactDetail contact={contact} flash={flash} />));
            },
        },
    }),
);
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

**Heuristic:** Use `remix/auth` for the login flow (verifying credentials or handling OAuth callbacks) and `remix/middleware/auth` for protecting routes on subsequent requests. Auth forms should use standard `<form>` submissions for progressive enhancement — authentication must work without client-side JavaScript.

**The auth middleware stack:**

```tsx
import { auth, createSessionAuthScheme, requireAuth } from "remix/middleware/auth";
import { Session } from "remix/session";
import { session } from "remix/middleware/session";

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
import { redirect } from "remix/response/redirect";

let passwordProvider = createCredentialsAuthProvider({
    parse(ctx) {
        let { email, password } = s.parse(AuthSchema, ctx.formData);
        return { email, password };
    },
    async verify({ email, password }) {
        return await users.verifyPassword(email, password);
    },
});

router.map(routes.auth.login.action, {
    async handler(ctx) {
        let user = await verifyCredentials(passwordProvider, ctx);

        if (user === null) {
            let session = ctx.get(Session);
            session.flash("error", "Invalid email or password");
            return redirect(routes.auth.login.href());
        }

        // Rotate session ID (prevents session fixation) and write auth record
        let session = completeAuth(ctx);
        session.set("auth", { userId: user.id });
        return redirect(routes.dashboard.href());
    },
});
```

**The login form (progressive enhancement):**

```tsx
export function LoginForm(handle: Handle<{ error?: string }>) {
    let props = handle.props;
    return () => (
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
import { Auth, requireAuth } from "remix/middleware/auth";
import type { GoodAuth } from "remix/middleware/auth";

router.map(routes.dashboard, {
    middleware: [requireAuth()],
    handler(ctx) {
        let { identity } = ctx.get(Auth) as GoodAuth<User>;
        return html(await renderDocument(<Dashboard user={identity} />));
    },
});
```

`requireAuth()` returns `401 Unauthorized` by default. Customize with `onFailure` to redirect to login or return a frame-aware response:

```tsx
let requireLogin = requireAuth({
    onFailure(ctx) {
        let isFrame = ctx.request.headers.get("x-remix-frame") === "true";
        if (isFrame) {
            return frame(render(<p>Please log in</p>), { status: 401 });
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
import { createBearerTokenAuthScheme, createSessionAuthScheme } from "remix/middleware/auth";

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

---

### 35. How do I handle file uploads?

**Decision:** How do I accept, validate, store, and serve user-uploaded files?

**Heuristic:** Use the `formData()` middleware with a custom `uploadHandler` to intercept file fields during form parsing. Store files in a durable backend (R2, filesystem) and return a URL string that replaces the file field in the parsed FormData. Serve uploaded files through a dedicated route.

**The upload handler:**

```tsx
import type { FileUpload } from "remix/form-data-parser";
import { routes } from "#/routes.ts";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];
const ALLOWED_TYPE_SET = new Set(ALLOWED_TYPES);

export async function uploadHandler(file: FileUpload): Promise<string | undefined> {
    // Empty file inputs still produce a multipart part — skip them so the
    // existing avatar value is preserved by the action.
    if (file.size === 0) return undefined;

    if (!ALLOWED_TYPE_SET.has(file.type)) {
        throw new Response(
            "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
            { status: 415 },
        );
    }

    let ext = file.name.split(".").pop() || "jpg";
    let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    await storage.set(key, file);
    return routes.uploads.href({ key });
}
```

**Key details:**

- The handler receives a `FileUpload` object (a `File` with metadata) for every file field in the form
- Return a **string** to replace the file with a URL, or `undefined` to drop the field entirely (use this for empty file inputs so the existing avatar value is preserved by the action)
- Build the returned URL via `routes.uploads.href({ key })` so it stays in sync with the route definition (see Recipe 6) — never hardcode `/uploads/${key}`
- Validate the file type early and throw a `Response` to short-circuit with an appropriate HTTP status. The `rescueResponses()` middleware (Recipe 7) catches it and turns it into the outgoing response
- Generate unique keys using a combination of field name, timestamp, and random suffix to prevent collisions

**Wiring the handler into middleware:**

```tsx
formData({ uploadHandler }),
```

Pass the handler to `formData()` in your middleware stack. Non-file fields are parsed normally; file fields are routed through your handler.

**Important timing consideration:** The upload handler runs during form data parsing — before `asyncContext()` and other middleware that follow `formData()` in the stack. This means `getContext()` is not available inside the handler. Access platform bindings (like R2 buckets) directly rather than through request context:

```tsx
import { env } from "cloudflare:workers";
let storage = new R2FileStorage(env.FILES);
```

**Serving uploaded files** — register a `GET /uploads/*key` action that streams from R2:

```tsx
import { createFileResponse as sendFile } from "remix/response/file";

// inside createController(routes, { actions: { ... } })
async uploads(ctx) {
    let file = await storage.get(ctx.params.key);
    if (!file) return new Response("File not found", { status: 404 });
    return sendFile(file, ctx.request, {
        cacheControl: "public, max-age=31536000",
    });
},
```

Use `createFileResponse` from `remix/response/file` to serve files with proper headers (content type, range requests, caching). The `cacheControl` option sets a long cache lifetime for immutable uploads.

**The upload form:**

```tsx
<RestfulForm
    action={routes.items.update.href({ id })}
    enctype="multipart/form-data"
    method={routes.items.update.method}
>
    <label>
        <span>Avatar</span>
        <div>
            <img alt="Current avatar" src={item.avatar || PLACEHOLDER_URL} />
            <label class="avatar-upload">
                <input accept={ALLOWED_TYPES.join(",")} hidden name="avatar" type="file" />
                <span>Choose Photo</span>
            </label>
        </div>
    </label>
    <button type="submit">Save</button>
</RestfulForm>
```

**Key rules:**

- Set `enctype="multipart/form-data"` on the form — without this, the browser sends file fields as empty strings
- Use `accept` on the file input to filter the file picker to allowed types (client-side hint only — always validate server-side too)
- Use a hidden file input with a styled label for custom upload button appearance
- In your controller, check whether a new file was uploaded. If no file was provided, preserve the existing value:

```tsx
let updates = s.parse(UpdateSchema, ctx.formData);

// Preserve existing avatar when no new file is uploaded
if (!updates.avatar) {
    updates.avatar = existingRecord.avatar ?? "";
}
```

**Defining the upload route:** Use a wildcard route to match nested file keys:

```tsx
uploads: get("/uploads/*key"),
```

This matches paths like `/uploads/avatar/1712345678-abc123.jpg`, with the full path after `/uploads/` captured as `params.key`.

---

### 36. How should I set up import aliases?

**Decision:** How do I avoid deep relative imports like `../../../components/Button.tsx`?

**Heuristic:** Use `package.json#imports` (Node.js subpath imports) instead of `tsconfig.json#paths`. Subpath imports are a runtime standard — they work in Node.js, Vite, Cloudflare Workers, and every bundler without additional configuration or plugins. TypeScript paths, by contrast, are a compile-time-only feature that requires bundler-specific `tsconfigPaths` plugins and can silently diverge between what TypeScript resolves and what your runtime resolves.

**Setting up the alias in `package.json`:**

```json
{
    "imports": {
        "#/*": "./app/*"
    }
}
```

The `#` prefix is required by the Node.js subpath imports spec. This maps `#/components/Button.tsx` to `./app/components/Button.tsx`.

**Using aliases in source code:**

```tsx
import { SearchBar } from "#/components/SearchBar.tsx";
import { routes } from "#/routes.ts";
import { database } from "#/middleware.ts";
import { link } from "#/utils/link.tsx";
```

**What you don't need:**

- No `paths` in `tsconfig.json` — TypeScript reads `package.json#imports` natively when `moduleResolution` is set to `"bundler"` (or `"node16"` / `"nodenext"`)
- No `resolve.alias` in `vite.config.ts` — Vite resolves `#` imports from `package.json` automatically
- No `resolve: { tsconfigPaths: true }` — this was needed for the old `~/` convention but is unnecessary with subpath imports

**Why `#` over `~` or `@`:**

| Prefix | Source                       | Runtime support                    | Requires plugin       |
| ------ | ---------------------------- | ---------------------------------- | --------------------- |
| `#`    | Node.js subpath imports spec | Yes (Node, Vite, Workers, Bun)     | No                    |
| `~`    | Convention (tsconfig paths)  | No — compile-time only             | Yes (`tsconfigPaths`) |
| `@`    | Convention (tsconfig paths)  | Conflicts with npm scoped packages | Yes                   |

The `#` prefix is the only one that works everywhere without configuration beyond `package.json`. It's a real module resolution feature, not a build-tool convention.

**The full `tsconfig.json`** — notice no `paths` section:

```json
{
    "include": ["**/*.ts", "**/*.tsx"],
    "exclude": ["dist"],
    "compilerOptions": {
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "jsxImportSource": "remix/ui",
        "verbatimModuleSyntax": true,
        "strict": true,
        "noEmit": true
    }
}
```

**Migration from `~` or `@` aliases:** Replace the prefix in all import statements and remove the `paths` entry from `tsconfig.json` and any `tsconfigPaths` plugin from `vite.config.ts`.

---

### 37. How do I deploy to Cloudflare Workers with D1 and R2?

**Decision:** How do I configure my Remix app to run on Cloudflare Workers with D1 (database) and R2 (file storage)?

**Heuristic:** Use `wrangler.jsonc` to declare your bindings, the `@cloudflare/vite-plugin` for dev/build integration, and platform-specific adapters for D1 and R2. Access bindings through `cloudflare:workers` at the top level and through request context in middleware.

**Wrangler configuration** (`wrangler.jsonc`):

```jsonc
{
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "my-app",
    "main": "./app/entry.server.tsx",
    "assets": { "directory": "dist/client" },
    "compatibility_date": "2026-04-02",
    "compatibility_flags": ["nodejs_compat"],
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "my-db",
            "database_id": "local",
            // Generated by `vp db:migrations:generate` from db/migrations/*.ts.
            // `migrations_dir` is resolved relative to this wrangler config file.
            "migrations_dir": "./db/d1-migrations",
        },
    ],
    "r2_buckets": [{ "binding": "FILES", "bucket_name": "my-files" }],
}
```

**Key fields:**

- `main` — Your server entry point. Cloudflare Workers loads this as the request handler.
- `assets.directory` — Points to the client build output. Workers serves these as static assets before hitting your server code.
- `compatibility_flags: ["nodejs_compat"]` — Enables Node.js API compatibility (required for `node:` imports like `node:path`, `node:timers/promises`).
- `d1_databases` — Declares D1 database bindings. Use `"database_id": "local"` for development; replace with the real ID for production. The `migrations_dir` points Wrangler at the generated SQL files (see Recipe 18).
- `r2_buckets` — Declares R2 object storage bindings.

**Generating types from bindings:**

Run `wrangler types` to generate a `worker-configuration.d.ts` file with the `Env` interface. This gives TypeScript knowledge of your bindings:

```tsx
// Auto-generated by `wrangler types`
interface Env {
    DB: D1Database;
    FILES: R2Bucket;
}
```

Wire this into your `vite.config.ts` as a run task so types are regenerated when `wrangler.jsonc` changes:

```tsx
run: {
    tasks: {
        typegen: {
            input: ["wrangler.jsonc"],
            command: "wrangler types",
        },
    },
},
```

**Accessing bindings:**

```tsx
// At module scope (for code that runs outside middleware, like upload handlers)
import { env } from "cloudflare:workers";
let db = env.DB;
let bucket = env.FILES;

// In middleware (preferred — inject into request context)
import { Database } from "remix/data-table";
import { type Middleware } from "remix/router";

type DatabaseEntry = { key: typeof Database; value: Database };

export function database(): Middleware<DatabaseEntry> {
    let adapter = new D1DatabaseAdapter(env.DB);
    let db = new Database(adapter);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}
```

**When to use `env` directly vs. context injection:**

| Approach                                           | When to use                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `import { env } from "cloudflare:workers"`         | Module-scope initialization, code that runs before middleware (e.g., upload handlers) |
| `ctx.get(Database)` / `getContext().get(Database)` | Controllers and data access functions — testable, swappable                           |

**Writing a D1 database adapter:**

The `remix/data-table` package expects a `DatabaseAdapter`. For D1, you need an adapter that uses D1's prepared-statement API for execution while delegating SQL generation to the built-in SQLite adapter from `remix/data-table/sqlite`:

```tsx
import { SqliteDatabaseAdapter } from "remix/data-table/sqlite";

// Reuse the SQLite adapter purely for SQL compilation (never touches the database)
let compiler = new SqliteDatabaseAdapter(null as never);

export class D1DatabaseAdapter implements DatabaseAdapter {
    dialect = "sqlite";
    #d1: D1Database;

    constructor(d1: D1Database) {
        this.#d1 = d1;
    }

    compileSql(operation) {
        return compiler.compileSql(operation);
    }

    async execute(request) {
        let statement = this.compileSql(request.operation)[0];
        let prepared = this.#d1.prepare(statement.text).bind(...statement.values);
        // ... execute and return results
    }
}
```

**D1 limitations to know:**

- **No SQL transactions** — D1 forbids `BEGIN`/`COMMIT`/`ROLLBACK`/`SAVEPOINT`. Use `d1.batch()` for atomic multi-statement execution if needed, but note this is incompatible with the adapter's streaming transaction model. Set `capabilities.savepoints = false` and `capabilities.transactionalDdl = false` in your adapter.
- **No migration locking** — Set `capabilities.migrationLock = false`. Migrations run at deploy time, so concurrent migration is unlikely, but be aware.

**Writing an R2 file storage adapter:**

Implement the `FileStorage` interface from `remix/file-storage` to wrap R2:

```tsx
import type { FileStorage } from "remix/file-storage";

export class R2FileStorage implements FileStorage {
    #r2: R2Bucket;

    constructor(r2: R2Bucket) {
        this.#r2 = r2;
    }

    async get(key: string): Promise<File | null> {
        let object = await this.#r2.get(key);
        if (!object) return null;
        let buffer = await object.arrayBuffer();
        return new File([buffer], object.key, {
            type: object.httpMetadata?.contentType,
        });
    }

    async set(key: string, file: File): Promise<void> {
        await this.#r2.put(key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
            customMetadata: { name: file.name },
        });
    }

    async remove(key: string): Promise<void> {
        await this.#r2.delete(key);
    }

    async has(key: string): Promise<boolean> {
        return (await this.#r2.head(key)) != null;
    }
}
```

**The development workflow:**

1. `wrangler.jsonc` declares your D1 + R2 bindings and points `migrations_dir` at `./db/d1-migrations`
2. `wrangler types` generates the `Env` interface (wired into Vite+ via the `typegen` task — see Recipe 20)
3. The Cloudflare Vite plugin (`@cloudflare/vite-plugin`) injects local proxies for D1/R2 during `vp dev`
4. `vp run db:migrations:apply:local` (chained from `vp dev`) compiles and applies SQL migrations to the local D1
5. Local D1 state persists in `.wrangler/state/v3/d1/` — `vp run db:reset` wipes it
6. `vp run db:migrations:deploy` (or `db:migrations:apply:remote`) applies SQL migrations to the remote database — needs `CLOUDFLARE_API_TOKEN`
7. `vp run deploy` (i.e. `wrangler deploy`) pushes your built worker to Cloudflare

**Production setup:**

Before deploying, create the D1 database and R2 bucket on Cloudflare, then update `wrangler.jsonc` with the real `database_id`:

```sh
wrangler d1 create my-db
wrangler r2 bucket create my-files
```

Replace `"database_id": "local"` with the ID returned by `wrangler d1 create`. Then run `vp run db:migrations:deploy` once to seed the schema on the remote DB.
