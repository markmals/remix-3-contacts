---
name: remix-navigation
description: >
  Use when showing loading indicators, tracking pending navigation states, setting up the client entry for SPA navigation with frames, choosing push vs replace history, highlighting active or pending list items with ArrayMatcher, or listening for destinationchange events.
---

# Remix Navigation

## The `Navigating` Class

A singleton that wraps the browser's Navigation API and emits `destinationchange` events:

```tsx
// utils/navigating.ts
export let navigating = new Navigating();
```

### Properties

- `navigating.to.state` -- `"idle"`, `"loading"`, or `"submitting"`
- `navigating.to.url` -- destination URL (or `null` when idle)
- `navigating.to.formData` -- form data if submitting (or `null`)
- `navigating.from.url` -- URL active when navigation started (or `null`)

Idle values are `null`, not `undefined`. Use optional chaining: `navigating.to.url?.searchParams`.

**Server safety:** `Navigating` skips event listener registration when `typeof window === "undefined"`. Components can reference it without conditional imports, but guard client-only logic with `isServer` checks.

## Listening for Navigation Changes

Register a `destinationchange` listener in the component setup to re-render on navigation state changes:

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

## Active/Pending State for List Items

Use `ArrayMatcher` from `remix/route-pattern` to derive active and pending state from URLs rather than stale props. This is necessary because frame-targeted navigations only update one frame -- components in other frames don't re-render.

```tsx
import { ArrayMatcher } from "remix/route-pattern";

// Setup: define which routes this item could match
let matcher = new ArrayMatcher<true>();
matcher.add(routes.posts.show.pattern, true);
matcher.add(routes.posts.edit.pattern, true);

// Render: derive active state from current URL
let currentMatch = !isServer ? matcher.match(location.href) : null;
let isActive = Number(currentMatch?.params?.id ?? selected) === item.id;

// Derive pending state from navigation destination
let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
let isPending =
  !isActive &&
  navigating.to.url?.pathname !== location.pathname &&
  Number(destination?.params.id) === item.id;
```

The `selected` prop serves as a server fallback for initial render and no-JS environments. On the client, URL-derived state takes precedence.

## Client Entry: Three-Phase Setup

The client entry (`entry.browser.ts`) sets up three things in a specific order. Ordering matters because the Navigation API uses "last `intercept()` call wins" semantics.

### Phase 1: Form Submission Handler (before `run`)

Must register before `run()` so `event.preventDefault()` on GET forms works before the Remix listener sees the event.

```tsx
import { navigate, run } from "remix/component";

navigation.addEventListener("navigate", async event => {
  if (!event.canIntercept) return;

  // Programmatic navigations: handled by built-in listener
  if (!event.sourceElement) return;
  // Anchors: handled by built-in listener
  if (event.sourceElement.closest("a, area")) return;

  // Read rmx-* attributes from the submit button for frame targeting
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
```

### Phase 2: Remix Runtime

Initializes module loading for hydrated components and frame resolution:

```tsx
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
```

### Phase 3: Focus Reset (after `run`)

Registered last so its `intercept()` call wins, preventing the browser from resetting focus to the top of the page during frame updates:

```tsx
navigation.addEventListener("navigate", event => {
  if (!event.canIntercept || event.defaultPrevented || event.navigationType === "traverse") {
    return;
  }
  event.intercept({ focusReset: "manual" });
});
```

Traverse (back/forward) navigations are left alone -- they are handled by the built-in Remix listener.

## History: Push vs Replace

| Scenario                                           | History mode        | Why                                                       |
| -------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| User clicks a link to a new page                   | **push** (default)  | Back button should return to previous page                |
| Search-as-you-type (after first keystroke)         | **push**            | Back button navigates between search states               |
| First search keystroke                             | **replace**         | Don't create an entry for the pre-search state with `?q=` |
| Optimistic update sync (`navigate(location.href)`) | **replace**         | Syncing server state shouldn't create history             |

```tsx
navigate(url);                          // Push (new history entry)
navigate(url, { history: "replace" });  // Replace (overwrite current entry)
```
