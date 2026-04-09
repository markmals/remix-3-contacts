---
name: remix-search
description: >-
    Use when implementing search, search-as-you-type, URL-driven filtering, or
    managing search query state in the URL with history management.
---

# Remix Search

## Core Principle

Search should always be **URL-driven** (the query lives in `?q=`). This makes search results linkable, back-button friendly, and server-renderable.

## Full Pattern

```tsx
export let SearchBar = clientEntry(import.meta.url, handle => {
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

## History Management

| Keystroke              | History mode              | Why                                                     |
| ---------------------- | ------------------------- | ------------------------------------------------------- |
| First search keystroke | `replace`                 | Don't create an entry for the pre-search URL with `?q=` |
| Subsequent keystrokes  | `push`                    | Back button navigates between meaningful search states  |
| Clearing the input     | (navigates without `?q=`) | Sidebar returns to the full list                        |

The first keystroke replaces so pressing back doesn't step through "s", "sa", "sam" one character at a time.

## Frame Targeting

If search results live in a specific frame, pass `target` to keep the rest of the page stable:

```tsx
await navigate(url.toString(), { target: "sidebar" });
```

If the app doesn't use frames (see remix-frames skill), omit the `target` option.

## Error Handling

Rapid typing triggers new `navigate()` calls that abort previous ones. The aborted navigation rejects with an `AbortError`. Wrap in `try/catch` to suppress these expected errors:

```tsx
try {
    await navigate(url.toString(), {
        /* ... */
    });
} catch {
    // Ignore AbortError from rapid typing
}
```

## Loading Indicator

Use the `navigating` singleton to derive loading state:

```tsx
addEventListeners(navigating, handle.signal, {
    destinationchange() {
        handle.update();
    },
});

// In render:
let searching = Boolean(navigating.to.url?.searchParams.has("q"));
```

The `destinationchange` event fires when navigation starts and completes, triggering re-renders so the spinner shows and hides automatically.

## Clearing the Search Param

When the input is emptied, delete `q` from the URL and navigate immediately without checking `isFirstSearch`:

```tsx
if (!event.currentTarget.value.trim()) {
    url.searchParams.delete("q");
    await navigate(url.toString(), { target: "sidebar" });
    return;
}
```
