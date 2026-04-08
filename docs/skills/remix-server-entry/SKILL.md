---
name: remix-server-entry
description: >
  Use when setting up the server entry file, ordering middleware in createRouter(), deciding where logic belongs (controllers vs middleware vs components vs data layer), or injecting request-scoped data with context keys and getContext().
---

# Remix Server Entry

## Middleware Stack

Middleware runs in order for every request. Put cheap/broad middleware first, expensive/specific middleware last.

```tsx
export let router = createRouter({
  middleware: [
    staticFiles("./public"),       // 1. Serve static files (short-circuits)
    staticFiles("./dist/client"),  // 2. Serve built client assets
    formData({ uploadHandler }),   // 3. Parse form data + file uploads
    methodOverride(),              // 4. Rewrite _method field to real HTTP method
    asyncContext(),                 // 5. Enable request-scoped context (getContext())
    loadDatabase(),                // 6. Initialize database, inject into context
    loadFileStorage(),             // 7. Inject file storage into context
    frameTarget(),                 // 8. Parse x-remix-target header into Frame.Target
  ],
});
```

### Why This Order Matters

1. **Static files first** -- most requests for CSS/JS/images return immediately without touching form parsing or database setup.
2. **Form data before method override** -- `methodOverride()` reads from parsed form data, so `formData()` must run first. Pass an `uploadHandler` to `formData()` if your app handles file uploads.
3. **Async context before database** -- the database middleware uses `context.set()` which requires async context to be active.
4. **Frame target last** -- cheap (only reads a header), but placing it after async context ensures `getContext()` works in frame-related utilities.

### HMR Support

Add at the bottom of your server entry:

```tsx
if (import.meta.hot) {
  import.meta.hot.accept();
}
```

## Where Logic Belongs

| Logic type                                     | Location                        | Why                          |
| ---------------------------------------------- | ------------------------------- | ---------------------------- |
| Request handling for a specific route          | **Controller** (`controllers/`) | Tied to a route's URL/method |
| Cross-cutting concern (auth, logging, parsing) | **Middleware** (`middleware/`)  | Runs across many routes      |
| UI rendering                                   | **Component** (`components/`)   | Presentation layer           |
| Data access / business rules                   | **Data layer** (`data/`)        | Reusable, testable           |
| Validation schemas                             | **`data/schemas.ts`**           | Shared between controllers   |
| Rendering helpers (document, frame)            | **`utils/render.tsx`**          | Shared rendering logic       |
| Frame primitives and link mixin                | **`utils/frame.tsx`**           | Shared frame utilities       |
| Platform adapters (D1, R2)                     | **`data/adapters/`**            | Swappable implementations    |

### Controllers

Objects satisfying the `Controller` type that map route actions to handler functions:

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

### Middleware

A function receiving `(context, next)` that returns a `Response`:

```tsx
async (context, next) => {
  context.set(Database, db);
  return next();
};
```

Call `next()` to pass through. You can modify context before `next()` or modify the response after.

## Request-Scoped Context

Use context keys and middleware injection to make data available throughout a request.

### Built-in Context Keys

Some packages export pre-defined keys. For example, `remix/data-table` exports `Database`:

```tsx
import { Database } from "remix/data-table";
```

### Setting Context in Middleware

```tsx
import { D1DatabaseAdapter } from "#/data/adapters/d1-data-table.ts";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/fetch-router";

export function loadDatabase(): Middleware {
  let adapter = new D1DatabaseAdapter(env.DB);
  let db = new Database(adapter);

  return (ctx, next) => {
    ctx.set(Database, db);
    return next();
  };
}
```

### Custom Context Keys

```tsx
import { createContextKey } from "remix/fetch-router";
export let MyService = createContextKey<MyServiceType>();
```

### Reading Context

```tsx
// In a controller action (context is passed directly):
let db = context.get(Database);

// Anywhere in the call stack (via async context):
import { getContext } from "remix/async-context-middleware";
let db = getContext().get(Database);
```

`asyncContext()` middleware makes the request context available anywhere via `getContext()` without threading it through function arguments. This is especially useful in data access functions called from controllers that don't directly receive the request context (see remix-database skill).
