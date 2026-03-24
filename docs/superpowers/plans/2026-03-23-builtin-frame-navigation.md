# Built-in Frame Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom frame router with Remix's built-in frame navigation primitives (`navigate()`, `rmx-target`, built-in navigation listener).

**Architecture:** Single detail `<Frame>` with inline sidebar. Shell-or-fragment routing pattern where every route checks `x-remix-target: detail` and returns either a full page or a detail fragment. All mutation forms are hydrated client entries using explicit `fetch()` + `navigate()`.

**Tech Stack:** Remix Component API (nightly), TypeScript, esbuild, Node.js

**Spec:** `docs/superpowers/specs/2026-03-23-builtin-frame-navigation-design.md`

**Verification commands:**

- `pnpm run typecheck` — TypeScript type checking
- `pnpm run lint` — Biome linting with auto-fix
- `pnpm run fmt` — Biome formatting with auto-fix

**No test framework is configured.** Manual browser testing is required for UI verification (the developer runs the dev server themselves). Never attempt to run the dev server.

**Commits:** The user handles all git commits. Do not run `git commit`. Stage files and suggest commit messages, but let the user decide when to commit.

---

## File Map

**Create:**

- `src/assets/Buttons.tsx` — `NewButton`, `EditButton`, `CancelButton`, `DeleteButton` client entries

**Modify:**

- `src/routes.ts` — Remove `frame` route group and `route` import
- `src/lib/render.tsx` — Add `isDetailFrameRequest()`, `documentWithSidebar()`, update `resolveFrame` to forward `x-remix-target`
- `src/router.tsx` — Remove frame controller, add shell-or-fragment home route
- `src/routes/contacts.tsx` — Shell-or-fragment pattern with `contactPage` helper
- `src/components/Document.tsx` — Inline sidebar, single detail frame, receive props
- `src/components/ShowContact.tsx` — Use `EditButton`, `DeleteButton` from Buttons.tsx, remove `routes` import
- `src/components/EditContact.tsx` — Import `CancelButton` from Buttons.tsx
- `src/assets/SidebarItem.tsx` — `TrieMatcher` instead of frame router, `rmx-target="detail"`
- `src/assets/SearchBar.tsx` — Remix `navigate()` instead of browser `navigation.navigate()`
- `src/assets/Favorite.tsx` — Remix `navigate()` instead of `navigation.reload()`
- `src/assets/entry.tsx` — Send `x-remix-frame` and `x-remix-target` headers in `resolveFrame`
- `src/lib/navigation.ts` — Remove `NavigationEnhancer`, `NavigateEvent`, `RouterEventMap`

**Delete:**

- `src/lib/frame-router/core.ts`
- `src/lib/frame-router/types.ts`
- `src/frames.ts`
- `src/assets/Navigator.tsx`
- `src/routes/frames.tsx`
- `src/assets/CancelButton.tsx`
- `src/assets/DeleteConfirm.tsx`
- `src/components/Sidebar.tsx`

---

## Task 1: Create `src/assets/Buttons.tsx`

Independent — no existing files reference it yet.

**Files:**

- Create: `src/assets/Buttons.tsx`

- [ ] **Step 1: Create the file**

Write `src/assets/Buttons.tsx` with four `clientEntry` exports: `NewButton`, `EditButton`, `CancelButton`, `DeleteButton`. All use `navigate` from `remix/component` for SPA navigation. `CancelButton` uses `navigation.back()` (browser Navigation API global).

Full content from spec (see `src/assets/Buttons.tsx` section).

---

## Task 2: Update `src/assets/Favorite.tsx`

Independent — only changes the `navigation.reload()` call.

**Files:**

- Modify: `src/assets/Favorite.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Add `navigate` to the import from `remix/component`**

```tsx
import { clientEntry, type Handle, navigate, on } from "remix/component";
```

- [ ] **Step 3: Replace `navigation.reload()` (line 39) with:**

```tsx
navigate(window.location.href, { history: "replace" });
```

---

## Task 3: Update `src/assets/entry.tsx`

Independent — only changes the `resolveFrame` callback signature and headers.

**Files:**

- Modify: `src/assets/entry.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Update resolveFrame**

Change:

```tsx
async resolveFrame(src, signal) {
    const response = await fetch(src, { headers: { accept: "text/html" }, signal });
    return response.body ?? (await response.text());
},
```

To:

```tsx
async resolveFrame(src, signal, target) {
    const headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
    if (target) headers.set("x-remix-target", target);
    const response = await fetch(src, { headers, signal });
    return response.body ?? (await response.text());
},
```

---

## Task 4: Update `src/assets/SearchBar.tsx`

Independent — only changes `navigation.navigate()` calls to Remix `navigate()`.

**Files:**

- Modify: `src/assets/SearchBar.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Add `navigate` to the import from `remix/component`**

```tsx
import { addEventListeners, clientEntry, type Handle, navigate, on } from "remix/component";
```

- [ ] **Step 3: Replace two `navigation.navigate()` calls in the input handler**

1. `navigation.navigate(url.toString());` → `navigate(url.toString());`
2. `navigation.navigate(url.toString(), { history: isFirstSearch ? "replace" : "auto" });` → `navigate(url.toString(), { history: isFirstSearch ? "replace" : "push" });`

Note: `"auto"` changes to `"push"` because Remix's `navigate()` only supports `"push" | "replace"`.

---

## Task 5: Core routing rewrite

This is the main architectural change. These files are interdependent and must be modified together — changing any one in isolation would break the build. Do all steps before running typecheck.

**Files:**

- Modify: `src/routes.ts`
- Modify: `src/lib/navigation.ts`
- Modify: `src/lib/render.tsx`
- Modify: `src/router.tsx`
- Modify: `src/routes/contacts.tsx`
- Modify: `src/components/Document.tsx`
- Modify: `src/assets/SidebarItem.tsx`
- Delete: `src/lib/frame-router/core.ts`, `src/lib/frame-router/types.ts`, `src/frames.ts`, `src/assets/Navigator.tsx`, `src/routes/frames.tsx`, `src/components/Sidebar.tsx`

- [ ] **Step 1: Read all files being modified**

Read these files to understand current state:

- `src/routes.ts`
- `src/lib/navigation.ts`
- `src/lib/render.tsx`
- `src/router.tsx`
- `src/routes/contacts.tsx`
- `src/components/Document.tsx`
- `src/assets/SidebarItem.tsx`

- [ ] **Step 2: Update `src/routes.ts`**

Remove the `route` import and the `frame` route group. Full content from spec.

- [ ] **Step 3: Slim down `src/lib/navigation.ts`**

Delete everything from `RouterEventMap` interface through end of file (approximately lines 106-201): `RouterEventMap`, `NavigateEvent` namespace, `NavigateEvent` class, `NavigationEnhancer` class.

Keep: global `Navigation` augmentation, `NavigatingEventMap`, `DestinationChangeEvent`, `NavigationStates`/`NavigationState` types, `isServer`, `Navigating` class, `navigating` singleton.

- [ ] **Step 4: Rewrite `src/lib/render.tsx`**

Replace entire file with spec's version. Key additions:

- `isDetailFrameRequest()` export — checks `x-remix-target: detail` header
- `documentWithSidebar(selected?)` export — fetches contacts, renders full Document
- `resolveFrame` now forwards `target` as `x-remix-target` header on internal sub-requests

Full content from spec (see `src/lib/render.tsx` section).

- [ ] **Step 5: Rewrite `src/router.tsx`**

Replace entire file with spec's version. Key changes:

- Remove `Document` import, `frame` controller import, `render` import from `./lib/render.tsx`
- Import `documentWithSidebar`, `isDetailFrameRequest`, `render` from `~/lib/render.tsx`
- Import `ZeroState` for home route's detail fragment
- Home route: shell-or-fragment handler (returns `<ZeroState />` for detail target, full document otherwise)
- Remove `router.map(routes.frame, frame)`

Full content from spec (see `src/router.tsx` section).

- [ ] **Step 6: Rewrite `src/routes/contacts.tsx`**

Replace entire file with spec's version. Key changes:

- Remove `Document` import, add `RemixNode` type import
- Import `documentWithSidebar`, `isDetailFrameRequest`, `render` from `~/lib/render.tsx`
- Add `contactPage(context, detail)` helper — checks `isDetailFrameRequest()`, fetches contact, returns detail fragment or full document
- `show` and `edit` are one-liner calls to `contactPage` with different JSX callbacks
- POST actions unchanged

Full content from spec (see `src/routes/contacts.tsx` section).

- [ ] **Step 7: Rewrite `src/components/Document.tsx`**

Replace entire file with spec's version. Key changes:

- Remove `assert`, `Navigator`, `frames`, `routes` imports
- Add `SidebarItem`, `SearchBar`, `NewButton`, `Contact` type imports
- Component accepts props: `{ contacts: Contact[]; query: string | null; selected: string }`
- Sidebar is inline `<nav>` with `<SidebarItem>` map (replaces `<Frame name={frames.sidebar.name}>`)
- Detail pane is `<Frame name="detail" src={url.toString()}>` (replaces `<Frame name={frames.detail.name}>`)
- No `<Navigator />` in body
- `<NewButton />` replaces the New `<form>`

Full content from spec (see `src/components/Document.tsx` section).

- [ ] **Step 8: Rewrite `src/assets/SidebarItem.tsx`**

Replace entire file with spec's version. Key changes:

- Remove `frames` import
- Add `TrieMatcher` import from `remix/route-pattern`
- Module-level `matcher` with `routes.contacts.show.pattern` and `routes.contacts.edit.pattern`
- `selected` prop type: `string` (was `string | null`)
- `matcher.match(navigating.to.url)` replaces `frames.$.match(navigating.to.url)`
- `rmx-target="detail"` on the `<a>` element

Full content from spec (see `src/assets/SidebarItem.tsx` section).

- [ ] **Step 9: Delete old files**

```bash
rm src/lib/frame-router/core.ts src/lib/frame-router/types.ts
rmdir src/lib/frame-router
rm src/frames.ts
rm src/assets/Navigator.tsx
rm src/routes/frames.tsx
rm src/components/Sidebar.tsx
```

---

## Task 6: Update `src/components/ShowContact.tsx`

Depends on Task 1 (Buttons.tsx exists).

**Files:**

- Modify: `src/components/ShowContact.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Update imports**

Replace:

```tsx
import { DeleteConfirm } from "~/assets/DeleteConfirm.tsx";
import { Favorite } from "~/assets/Favorite.tsx";
```

With:

```tsx
import { DeleteButton, EditButton } from "~/assets/Buttons.tsx";
import { Favorite } from "~/assets/Favorite.tsx";
```

Also remove `import { routes } from "~/routes.ts";` — it becomes unused after the next steps.

- [ ] **Step 3: Replace Edit form with EditButton**

Replace the Edit `<form>` block (lines 52-59: `<form action={routes.contacts.edit.href(...)}>` with its `<button>`) with:

```tsx
<EditButton contactId={props.contact.id} query={props.query} />
```

- [ ] **Step 4: Replace DeleteConfirm with DeleteButton**

Replace `<DeleteConfirm contactId={props.contact.id} />` with `<DeleteButton contactId={props.contact.id} />`.

---

## Task 7: Update `src/components/EditContact.tsx`

Depends on Task 1 (Buttons.tsx exists).

**Files:**

- Modify: `src/components/EditContact.tsx`

- [ ] **Step 1: Read the current file**

- [ ] **Step 2: Update import**

Change:

```tsx
import { CancelButton } from "~/assets/CancelButton.tsx";
```

To:

```tsx
import { CancelButton } from "~/assets/Buttons.tsx";
```

---

## Task 8: Delete consolidated button files

Old individual button files are now replaced by `Buttons.tsx`.

**Files:**

- Delete: `src/assets/CancelButton.tsx`
- Delete: `src/assets/DeleteConfirm.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/assets/CancelButton.tsx src/assets/DeleteConfirm.tsx
```

---

## Task 9: Verify and fix

Run all verification commands and fix any issues.

- [ ] **Step 1: Run typecheck**

```bash
pnpm run typecheck
```

Expected: no errors. Common issues to watch for:

- Missing imports (e.g., `addEventListeners` if not in an import)
- Type mismatches on `selected` prop (`string` vs `string | null`)
- Unused imports in partially-updated files

- [ ] **Step 2: Run lint and fmt**

```bash
pnpm run lint && pnpm run fmt
```

Expected: auto-fixes applied. Biome may flag unused imports or missing type-only annotations.

- [ ] **Step 3: Fix any issues found, then re-run**

```bash
pnpm run typecheck && pnpm run lint && pnpm run fmt
```

Expected: all pass clean with no further changes.
