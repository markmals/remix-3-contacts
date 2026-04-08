---
name: remix-interactions
description: >
  Use when handling DOM events, accessing DOM nodes with refs, doing post-render
  work (focus, scroll, measurement), handling keyboard shortcuts, implementing
  press or drag interactions, managing listener lifetimes with AbortController,
  or creating reusable mixins with createMixin().
---

# Interactions and DOM Access

## DOM Refs with `ref()`

Use `ref()` to get a callback with the DOM node when it is first inserted.

```tsx
import { ref } from "remix/component";

// One-shot (fires on insert)
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

## Post-Render DOM Work

When you need the DOM to reflect the latest state before doing measurement, focus, or scroll work.

### `handle.queueTask()` -- Runs After Each Render Commit

Place inside the render function body. It runs after the DOM commits.

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
                <div mix={[ref(node => { contentNode = node; })]}>
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

### `await handle.update()` -- Sequential State-Then-DOM

Returns an `AbortSignal` that cancels if the component unmounts.

```tsx
on("submit", async event => {
    event.preventDefault();
    submitting = true;
    let signal = await handle.update();

    // DOM now reflects submitting=true, safe to read layout or focus
    let response = await fetch(url, { method: "POST", body: formData, signal });
});
```

### When to Use Each

| Pattern                 | Use for                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `ref(node => ...)`      | One-time setup when the node is first inserted                                     |
| `handle.queueTask(fn)`  | Post-render work triggered by state changes in render (focus, scroll, measurement) |
| `await handle.update()` | Sequential async flows where you need the DOM updated before continuing            |

**Important:** Never do focus, scroll, or measurement work inline in the render function. The DOM has not committed yet. Always use `handle.queueTask()` or `await handle.update()`.

## Keyboard Events with `keysEvents()`

Dispatches `keydown` by key name -- no manual `if (event.key === ...)` branching.

```tsx
import { keysEvents } from "remix/component";

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

## Unified Press with `pressEvents()`

Normalizes click, touch, and Enter/Space into a single interaction model for non-button elements.

```tsx
import { pressEvents } from "remix/component";

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

## `link()` Mixin -- Type-Safe Frame Targeting

The `link()` mixin targets frames from `<a>` and `<button>` elements with compile-time frame name checking (see remix-frames skill).

```tsx
import { link } from "#/utils/frame.tsx";

<a href={routes.contacts.show.href({ id })} mix={link({ target: "detail" })}>
    View
</a>;
```

Prefer real `<a>` and `<form><button>` tags with `link()` -- they are accessible, work without JavaScript, and provide type safety for frame names.

## Persistent vs Session-Based Listeners

### Persistent Listeners (Always Active)

Use `mix={[on(...)]}` for behavior that should always be active while mounted.

```tsx
<div mix={[on("pointerdown", event => { startDragSession(event); })]} />
```

### Session-Based Listeners (AbortController Pattern)

Use imperative `addEventListener` with a scoped `AbortController` for listeners that only exist during a short-lived interaction (drag, resize, long-press).

```tsx
on("pointerdown", event => {
    let controller = new AbortController();
    let { signal } = controller;

    addEventListener("pointermove", event => {
        updatePosition(event);
        handle.update();
    }, { signal });

    addEventListener("pointerup", () => {
        finishDrag();
        controller.abort(); // Tear down all session listeners
        handle.update();
    }, { signal });

    addEventListener("pointercancel", () => {
        cancelDrag();
        controller.abort();
        handle.update();
    }, { signal });
});
```

### Listener Type Summary

| Listener type                  | Pattern                                              | Example                                             |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| Always needed while mounted    | `mix={[on(...)]}`                                    | Click handlers, submit handlers, keyboard shortcuts |
| Only needed during interaction | Imperative `addEventListener` with `AbortController` | Drag tracking, resize handles, pointer capture      |
| Global, for component lifetime | `addEventListeners(target, handle.signal, {...})`    | Window resize, navigation state changes             |

## Creating Reusable Mixins with `createMixin()`

### When to Use

- Reusable host behavior composing low-level DOM events into one semantic interaction (drag-and-drop, swipe gestures)
- Interaction keeps timing/pointer/gesture state that belongs to the host element
- You want to dispatch custom events or attach reusable behavior to different elements

### When NOT to Use

- Logic is only used once -- prefer `on()` + setup-scope state
- Shared part is an async/request helper -- share the helper, not a mixin
- Form-local state (`submitting`, `error`) -- keep it in the component

### Basic Mixin -- Pure Prop Transform

```tsx
import { createMixin } from "remix/component";

let withTitle = createMixin(() => (title: string, props: { title?: string }) => (
    <handle.element {...props} title={title} />
));
```

### Lifecycle-Managed Mixin -- Imperative Setup on Insert

```tsx
let withAutofocus = createMixin<HTMLElement>(handle => {
    handle.addEventListener("insert", event => {
        event.node.focus();
    });

    return props => <handle.element {...props} />;
});
```

### Core Lifecycle Semantics

1. A mixin handle is tied to one mounted host node lifecycle
2. `insert` fires when the host node is available for imperative setup
3. `remove` fires for teardown of that lifecycle
4. `handle.queueTask(fn)` runs post-commit and receives `(node, signal)` for mixins
5. Render functions should stay pure -- side effects belong in `insert`, `remove`, or queued work

### Post-Commit DOM Work in a Mixin

```tsx
handle.queueTask((node, signal) => {
    node.removeEventListener(prevType, stableHandler);
    node.addEventListener(nextType, stableHandler);
});
```

Only use `signal` when the work is async or cancellation-sensitive.
