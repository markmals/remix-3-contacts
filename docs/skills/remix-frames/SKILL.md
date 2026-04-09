---
name: remix-frames
description: >-
    Use when working with frames, partial page updates, frame targeting, defining
    Frame.Target, using the link() mixin, or deciding between full-page and frame
    responses.
---

# Remix Frames

## When to Use Frames

Use frames when your page has regions that:

- Update independently (e.g., a navigation list and a content area)
- Have different data requirements
- Should be navigable without reloading the entire page

Not every app needs frames. A single-column page that always renders as a whole does not benefit from them.

## Defining Frames in the Document

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

Each `<Frame>` is a named region. `src` tells the server where to fetch initial content. On the server, `resolveFrame` is called during `renderToStream` to load frame content inline. On the client, frames are fetched via the `resolveFrame` callback in `run()`.

## Frame.Target Class

Type-safe server-side frame detection using the `x-remix-target` header:

```tsx
import * as s from "remix/data-schema";
import { Frame as RemixFrame } from "remix/component";
import type { Middleware } from "remix/fetch-router";

export namespace Frame {
    export const Name = s.union([s.literal("sidebar" as const), s.literal("detail" as const)]);
    export type Name = s.InferOutput<typeof Name>;

    export class Target {
        #name: string | null;

        constructor(headers: Headers) {
            this.#name = headers.get("x-remix-target");
        }

        is(name: Frame.Name): boolean {
            return this.#name === name;
        }

        get exists() {
            let { success } = s.parseSafe(Frame.Name, this.#name);
            return success;
        }
    }
}
```

### frameTarget Middleware

Parses the header once per request and injects it into context:

```tsx
export function frameTarget(): Middleware {
    return (ctx, next) => {
        ctx.set(Frame.Target, new Frame.Target(ctx.headers));
        return next();
    };
}
```

Use `ctx.get(Frame.Target)` in controllers:

```tsx
let target = ctx.get(Frame.Target);

if (target.is("sidebar")) return sidebar();
if (target.is("detail")) return frame(<ItemDetail item={item} />);
return document(); // Full page (initial load, hard refresh, no JS)
```

## The `link()` Mixin (Type-Safe Targeting)

Renders `rmx-*` attributes onto anchor or button elements with type safety on frame names.

### Definition

```tsx
import { createMixin } from "remix/component";

export type LinkProps = { target?: Frame.Name; src?: URL; resetScroll?: boolean };

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

### On Links

```tsx
import { link } from "#/utils/frame.tsx";

<a href={routes.contacts.show.href({ id: contact.id })} mix={link({ target: "detail" })}>
    {contact.first} {contact.last}
</a>;
```

### On Form Buttons

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

For form submissions, the client entry's navigate listener reads `rmx-*` attributes from `event.sourceElement` (the submit button), so a server-only form can target a frame without hydration.

### Available Props

| Prop          | Type         | Purpose                               |
| ------------- | ------------ | ------------------------------------- |
| `target`      | `Frame.Name` | Target a named frame                  |
| `src`         | `URL`        | Override the frame content source URL |
| `resetScroll` | `boolean`    | Reset scroll position on frame update |

Declarative equivalents of `navigate()` options:

```tsx
navigate(url, { target: "detail", src: someUrl, resetScroll: true });
```

## Full-Page vs. Frame Response Decision

Each controller handles the same route for initial loads and frame updates. Use `Frame.Target` to return the right response:

```tsx
async function contactPage(detail: (contact: Contact) => RemixNode) {
    try {
        let ctx = getContext();
        let target = ctx.get(Frame.Target);
        let { id } = s.parse(IdSchema, ctx.params);

        if (target.is("sidebar")) {
            return sidebar(id);
        } else {
            let contact = await getContact(id);
            if (!contact) throw contact;

            if (target.is("detail")) {
                return frame(detail(contact));
            }

            return document();
        }
    } catch {
        return redirect(routes.home.href());
    }
}
```

Controllers become one-liners:

```tsx
async show(ctx) {
    let { q } = s.parse(QuerySchema, ctx.url.searchParams);
    return await contactPage(contact => <ShowContact contact={contact} query={q} />);
},
async edit() {
    return await contactPage(contact => <EditContact contact={contact} />);
},
```

### The Two Response Types

| Type          | Content                                       | When                                            |
| ------------- | --------------------------------------------- | ----------------------------------------------- |
| `document()`  | Full HTML page (`<html>`, `<head>`, `<body>`) | Initial page load, hard refresh, no-JS fallback |
| `frame(node)` | HTML fragment for a specific frame region     | Named frame is targeted via navigation          |

## Frame Resolution on the Server

When rendering a full document, nested `<Frame>` components need content resolved. The `resolveFrame` callback in `renderToStream` handles this:

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

This internally routes the frame's `src` through the router, so each frame's content is produced by the same controller logic that handles direct frame requests.
