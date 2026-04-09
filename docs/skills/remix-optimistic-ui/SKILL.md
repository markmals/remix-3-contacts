---
name: remix-optimistic-ui
description: >-
    Use when implementing optimistic UI updates, toggle buttons, or any pattern
    that needs instant visual feedback before the server responds.
---

# Remix Optimistic UI

## When to Use

Use optimistic updates for toggle-like actions where:

- The expected outcome is **predictable** (toggling a boolean, incrementing a count)
- The action is **unlikely to fail**
- Instant feedback **significantly improves** perceived performance

## The Pattern

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

## Key Details

### `handle.update()` Returns an AbortSignal

Pass it to `fetch` -- if the component unmounts or re-renders before the fetch completes, the request is automatically cancelled.

### The `submitting` Flag

Prevents the server-provided prop from overwriting the optimistic value during re-renders that happen while the fetch is in flight.

### Sync with `navigate()`

```tsx
navigate(window.location.href, { history: "replace" });
```

Triggers a soft reload that syncs all frames with the latest server state without adding a history entry. This is how the optimistic value gets replaced by the real server value after success.

### Rollback

On failure, revert local state to its previous value and call `handle.update()` to re-render with the rolled-back state. No navigate needed -- the UI simply returns to its pre-optimistic state.

## Requirements

- The component **must** use `clientEntry` for hydration (see remix-components skill)
- Form submission uses Level 4 fetch-based pattern (see remix-forms skill)
- All props must be serializable
