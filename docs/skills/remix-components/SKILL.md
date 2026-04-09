---
name: remix-components
description: >-
    Use when building or modifying Remix 3 components, deciding whether a component
    should be server-only or hydrated, using the factory pattern, or composing
    islands of interactivity.
---

# Remix 3 Components

## Factory Pattern

Every Remix 3 component is a factory: a function that returns a render function. The outer function is the **setup** phase (runs once); the inner function is the **render** phase (runs on every update).

### Server-Only Component (zero client JS)

```tsx
export function UserCard() {
    // Setup: runs once per render on the server
    return (props: { user: User }) => (
        // Render: the actual JSX
        <div>{props.user.name}</div>
    );
}
```

No `clientEntry` wrapper, no hydration, no JS shipped.

### Hydrated Component (ships JS to client)

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

## When to Hydrate

Default to **server-only**. Only wrap with `clientEntry` when the component needs:

- Event handlers (`on("click")`, `on("submit")`, `on("input")`)
- Local state that changes without a full page navigation
- Browser APIs (`window`, `navigation`, `localStorage`)
- Optimistic updates or loading states (see remix-optimistic-ui skill)

## `clientEntry` Shape

```tsx
clientEntry(import.meta.url, setupFn);
```

- `setupFn` receives a `Handle` and returns the render function
- Setup runs once on hydration; render runs on every update

### What Goes Where

| Location   | Purpose                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| **Setup**  | Event listener registration (`addEventListeners`), one-time init, state variable declarations |
| **Render** | JSX output, derived values, conditional logic based on current props/state                    |

## Serialization Constraint

All props passed to a `clientEntry` component must be serializable: strings, numbers, booleans, plain objects, arrays. No functions, class instances, or DOM nodes.

## Islands Architecture (Composition)

Server-only components can contain hydrated components, creating islands of interactivity:

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

The server renders the full page; only interactive pieces ship JavaScript. Surrounding server-only markup is static HTML with zero runtime cost.
