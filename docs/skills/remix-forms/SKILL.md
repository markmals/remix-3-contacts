---
name: remix-forms
description: >-
  Use when adding forms, handling form submissions, parsing/validating form data
  or search params, implementing RestfulForm, or using method override for
  PUT/PATCH/DELETE.
---

# Remix Forms

## Progressive Enhancement Levels

Start with plain HTML forms. Layer on client-side enhancement only as needed.

### Level 1 -- Plain HTML (no JS required)

```tsx
export function CreateButton() {
    return () => (
        <form action={routes.items.create.href()} method="POST">
            <button type="submit">New</button>
        </form>
    );
}
```

Works without JavaScript. Browser POSTs, server redirects.

### Level 2 -- Enhanced with `navigate()` (frame-targeted)

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

`target: "content"` updates only the named frame (see remix-frames skill).

### Level 3 -- Pre-submission guard

```tsx
mix={on("submit", event => {
    if (!confirm("Delete this record?")) {
        event.preventDefault();
    }
})}
```

Call `event.preventDefault()` to cancel. Otherwise the form submits normally.

### Level 4 -- Fetch-based submission (optimistic UI)

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

Full control over the response. Use for optimistic UI (see remix-optimistic-ui skill) or conditional redirects.

## RestfulForm Component

HTML forms only support GET and POST. Use `RestfulForm` with `methodOverride()` middleware for PUT/PATCH/DELETE:

```tsx
import type { RequestMethod } from "remix/fetch-router";

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

### Usage with Type-Safe Routes

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

`routes.*.method` keeps forms in sync with route definitions automatically.

## Schema Validation with `remix/data-schema`

Always validate at the boundary where external data enters the system.

### Defining Schemas

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

### Parsing in Controllers

```tsx
// Parse search params (URLSearchParams)
let { q } = s.parse(SearchSchema, context.url.searchParams);

// Parse form data (FormData from request body)
let { enabled } = s.parse(ToggleSchema, context.get(FormData));
let profile = s.parse(ProfileSchema, context.get(FormData));
```

### Key Concepts

| Utility | Purpose |
|---------|---------|
| `f.object()` / `f.field()` | Handle FormData extraction (fields are always strings in raw form) |
| `coerce.boolean()` | Convert string `"true"`/`"false"` to actual booleans |
| `s.defaulted()` | Provide fallback values for missing fields |
| `s.union()` | Allow multiple types (e.g., string or undefined for optional params) |
| `s.parse()` | Throws on validation failure -- typed data or error, never silently wrong types |
