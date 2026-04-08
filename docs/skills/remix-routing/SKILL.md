---
name: remix-routing
description: >
  Use when defining routes with route()/get()/patch()/resources(), generating type-safe URLs with .href(), accessing .method on routes, using wildcard params, mapping routes to controllers, or implementing Post/Redirect/Get after mutations.
---

# Remix Routing

## Route Definitions

All routes live in a single `routes.ts` file. Use `route()` with HTTP method helpers for type-safe, centralized URL definitions.

```tsx
import { route, resources, get, patch } from "remix/fetch-router/routes";

export let routes = route({
  home: get("/"),
  uploads: get("/uploads/*key"),
  contacts: {
    ...resources("/contacts", { exclude: ["index", "new"] }),
    favorite: patch("/contacts/:id/favorite"),
  },
});
```

### HTTP Method Helpers

Use `get()`, `post()`, `put()`, `patch()`, and `del()` for custom routes. Shorter and clearer than the `{ method, pattern }` object form.

### `resources()` — RESTful Route Sets

`resources("/contacts")` generates routes for `index`, `new`, `show`, `create`, `edit`, `update`, and `destroy`. Use `exclude` to omit unneeded routes:

```tsx
resources("/contacts", { exclude: ["index", "new"] });
```

### Wildcard Parameters

Use `*name` for catch-all segments:

```tsx
get("/uploads/*key")
// /uploads/avatar/123-abc.jpg → params.key = "avatar/123-abc.jpg"
```

## Type-safe URL Generation

```tsx
routes.contacts.show.href({ id: 42 });              // "/contacts/42"
routes.contacts.edit.href({ id: 42 }, { q: "sam" }); // "/contacts/42/edit?q=sam"
routes.home.href();                                   // "/"
```

Never hardcode URL strings in components or controllers.

## The `.method` Property

Each route exposes its HTTP method. Use with `RestfulForm` (see remix-forms skill) to keep forms in sync:

```tsx
routes.contacts.update.method;  // "PATCH"
routes.contacts.destroy.method; // "DELETE"
routes.contacts.create.method;  // "POST"
```

## Mapping Routes to Controllers

In the server entry (see remix-server-entry skill):

```tsx
router.map(routes.home, async () => { /* ... */ });
router.map(routes.posts, postsController); // Maps all sub-routes
```

Controllers satisfy the `Controller` type and map route actions to handler functions:

```tsx
export default {
  actions: {
    async show(context) { /* ... */ },
    async create(context) { /* ... */ },
    async update(context) { /* ... */ },
    async destroy(context) { /* ... */ },
  },
} satisfies Controller<typeof routes.posts>;
```

`satisfies Controller<typeof routes.posts>` ensures action names match route definitions. Each action receives typed `params` based on the route pattern.

## Post/Redirect/Get After Mutations

After every mutation, redirect to the appropriate page:

```tsx
// After create: redirect to edit page for the new record
async create() {
  let id = await createPost();
  return redirect(routes.posts.edit.href({ id }));
}

// After update: redirect to show page
async update(context) {
  let data = s.parse(PostSchema, context.get(FormData));
  await updatePost(Number(context.params.id), data);
  return redirect(routes.posts.show.href({ id: context.params.id }));
}

// After delete: redirect to index or home
async destroy(context) {
  await deletePost(Number(context.params.id));
  return redirect(routes.posts.index.href());
}
```

PRG prevents duplicate submissions on refresh and ensures the back button works correctly.

**For non-navigating mutations** (like toggling a boolean), return data instead of redirecting:

```tsx
async toggle(context) {
  let { enabled } = s.parse(ToggleSchema, context.get(FormData));
  let updated = await updateItem(Number(context.params.id), { enabled });
  return Response.json(updated);
}
```
