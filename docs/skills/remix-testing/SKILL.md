---
name: remix-testing
description: >
  Use when writing component tests, setting up test rendering with createRoot,
  asserting DOM state, testing user interactions, or understanding test
  patterns and anti-patterns for Remix components.
---

# Testing Components

Use `createRoot()` to mount components in a real DOM container and `root.flush()` to synchronously process renders and queued tasks. Test through real DOM interactions rather than mocking framework internals.

## Basic Test Pattern

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

## When `root.flush()` is Needed

- **After `root.render()`** -- so listeners and queued tasks from the initial render are attached
- **After user interactions** that call `handle.update()` -- so the DOM reflects the new state
- **After async work resolves** if the component uses `handle.queueTask()` -- so post-render effects have run

## Cleanup

```tsx
root.dispose();
```

Use `root.dispose()` to verify cleanup behavior (global listeners removed, timers cleared). Call it at the end of each test or in an `afterEach` block.

## High-Value Testing Patterns

- **Minimal component state:** Test the fewest state transitions that prove the behavior
- **Work in event handlers first:** Verify that click/submit/input handlers produce the right DOM changes
- **Use `queueTask` assertions:** When a component uses `handle.queueTask()`, flush and then assert the post-render effect (focus moved, scroll position changed, etc.)
- **Prefer browser or CSS state:** For hover/focus behavior, test the actual focus state on DOM nodes rather than checking CSS classes

## What to Avoid

- Testing implementation-only markers (data attributes, internal class names) unless they are the only stable assertion point
- Over-mocking framework behavior that can be exercised with real DOM interactions
- Repeating the same navigation assertion across many paths when one representative flow proves the behavior
