# Update Remix Docs & APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale local documentation with current upstream content, update packages to latest preview/main, and fix all breaking API changes.

**Architecture:** Fetch-then-diff approach. Replace docs first (uncommitted), update packages (committed separately), then use git diff + typecheck to identify and fix all breaking changes across the codebase.

**Tech Stack:** Remix 3 (preview/main), TypeScript, pnpm, gh CLI for GitHub API access.

**Spec:** `docs/superpowers/specs/2026-03-22-update-remix-docs-and-apis-design.md`

---

## Breaking Changes Summary

These upstream changes affect this codebase and must be addressed:

### Component package

- **Interaction package removed**: `on(target, listeners)` from `remix/interaction` → `addEventListeners(target, signal, listeners)` from `remix/component`
- **`handle.on()` removed**: `handle.on(target, listeners)` → `addEventListeners(target, handle.signal, listeners)`
- **`TypedEventTarget` moved**: now exported from `remix/component`
- **Built-in frame navigation**: `rmx-target`/`rmx-src` attributes, `navigate()`, `link()` mixin — replaces our custom `NavigationEnhancer`
- **`resolveFrame` signature changed**: server `resolveFrame(src)` → `resolveFrame(src, signal, target)` with `ResolveFrameContext`; client `resolveFrame(src)` → `resolveFrame(src, signal, target)`
- **SSR frame context**: `renderToStream()` accepts `frameSrc`/`topFrameSrc`, nested frame renders use `ResolveFrameContext`
- **`on` prop removed**: use `on()` mixin with `mix` prop (verify if our code uses this)
- **`connect` prop removed**: use `ref()` mixin (verify if our code uses this)

### Fetch-router

- **Controller shape changed**: `{ show, edit, ... }` → `{ actions: { show, edit, ... } }`
- **`BuildAction` generics changed**: `BuildAction<"GET", route>` → no request-method generic
- **`context.formData` removed**: use `context.get(FormData)` — check if controller action handlers still destructure `formData` directly
- **`action` → `handler`**: in Action object form

### Data-table

- **`createTable(...)` → `table(...)`**: renamed helper
- **Column definitions**: now use `column(...)` builders
- **`sql` import**: still from `remix/data-table` (unchanged)

### Form-data-middleware

- **`context.formData` removed**: now uses `context.set(FormData, formData)` internally

---

## File Map

Files that will be modified or deleted:

| File                             | Change                           | Reason                                                                                      |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `docs/*.md` (21 files)           | Delete all top-level `.md` files | Replace with upstream content                                                               |
| `docs/*.md` (27 files)           | Create                           | Fresh upstream docs                                                                         |
| `pnpm-lock.yaml`                 | Modify                           | Package update                                                                              |
| `src/lib/navigation.ts`          | Delete or heavily rewrite        | `remix/interaction` removed; built-in frame navigation replaces custom `NavigationEnhancer` |
| `src/assets/Navigator.tsx`       | Rewrite                          | `handle.on()` removed; use built-in frame navigation APIs                                   |
| `src/lib/render.tsx`             | Modify                           | `resolveFrame` signature changed                                                            |
| `src/assets/entry.tsx`           | Modify                           | `resolveFrame` signature changed                                                            |
| `src/routes/contacts.tsx`        | Modify                           | Controller shape → `{ actions }`, `BuildAction` generics                                    |
| `src/routes/frames.tsx`          | Modify                           | Controller shape → `{ actions }`                                                            |
| `src/router.tsx`                 | Modify                           | Verify `router.map()` still works with new controller shape                                 |
| `src/lib/database/contacts.ts`   | Modify                           | `createTable` → `table`, column definition changes                                          |
| `src/lib/database/middleware.ts` | Verify                           | `createDatabase` may become `new Database(...)` (or stay as-is)                             |
| `src/lib/frame-router/core.ts`   | Verify/simplify                  | Check if built-in frame navigation reduces need for custom frame router                     |
| `src/frames.ts`                  | Verify/simplify                  | May be simplified if built-in navigation handles frame resolution                           |
| `src/components/Document.tsx`    | Verify                           | Frame navigation attributes may affect anchor/form rendering                                |

---

### Task 1: Fetch upstream documentation

**Files:**

- Delete: all 21 `.md` files at the top level of `docs/`
- Create: 27 new `.md` files in `docs/`

- [ ] **Step 1: Delete existing top-level docs**

```bash
find docs -maxdepth 1 -name '*.md' -delete
```

- [ ] **Step 2: Fetch 15 component docs from `packages/component/docs/`**

```bash
for file in components composition context events frames getting-started handle hydration interactions patterns server-rendering spring styling testing tween; do
  gh api "repos/remix-run/remix/contents/packages/component/docs/${file}.md" --jq '.content' | base64 -d > "docs/${file}.md"
done
```

Verify: `ls docs/*.md | wc -l` should show 15.

- [ ] **Step 3: Fetch 12 package READMEs**

```bash
for pkg in async-context-middleware fetch-router form-data-middleware method-override-middleware static-middleware response interaction route-pattern data-table data-table-sqlite data-schema node-fetch-server; do
  gh api "repos/remix-run/remix/contents/packages/${pkg}/README.md" --jq '.content' | base64 -d > "docs/${pkg}.md"
done
```

Verify: `ls docs/*.md | wc -l` should show 27.

Note: `interactions.md` (component doc about interaction patterns) and `interaction.md` (package README for the now-removed interaction package) are intentionally distinct files.

- [ ] **Step 4: Verify all files are non-empty**

```bash
for f in docs/*.md; do
  size=$(wc -c < "$f")
  if [ "$size" -lt 10 ]; then
    echo "WARNING: $f is suspiciously small ($size bytes)"
  fi
done
```

Do NOT commit yet — we need the diff for analysis in Task 4.

---

### Task 2: Update packages

**Files:**

- Modify: `pnpm-lock.yaml`, possibly `package.json`

- [ ] **Step 1: Update remix package**

```bash
pnpm update
```

- [ ] **Step 2: Commit lockfile separately**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Update remix packages to latest preview/main"
```

- [ ] **Step 3: Run typecheck baseline**

```bash
pnpm run typecheck
```

Record all errors — these are the breaking changes we need to fix.

---

### Task 3: Analyze API changes via doc diff

**Files:** None modified — analysis only.

- [ ] **Step 1: Review doc diff for breaking changes**

```bash
git diff -- docs/
```

Focus on:

- Changed function signatures
- Removed exports
- New required parameters
- Deprecated patterns

- [ ] **Step 2: Cross-reference with typecheck errors from Task 2**

Combine the doc diff analysis with the typecheck errors to build a complete list of code changes needed. The breaking changes summary at the top of this plan documents what we've already identified from upstream changesets.

---

### Task 4: Fix interaction → component migration

This is the largest change. The `remix/interaction` package is removed entirely.

**Files:**

- Modify: `src/lib/navigation.ts`
- Modify: `src/assets/Navigator.tsx`

- [ ] **Step 1: Update imports in `src/lib/navigation.ts`**

Change:

```ts
import { on, TypedEventTarget } from "remix/interaction";
```

To:

```ts
import { addEventListeners, TypedEventTarget } from "remix/component";
```

- [ ] **Step 2: Replace `on()` calls with `addEventListeners()` in `src/lib/navigation.ts`**

The `on(target, listeners)` pattern becomes `addEventListeners(target, signal, listeners)`.

In the `Navigating` class constructor (~line 75):

```ts
// Before
const dispose = on(navigation, {
    navigate: event => { ... },
    currententrychange: () => { ... },
});

// After
const controller = new AbortController();
addEventListeners(navigation, controller.signal, {
    navigate: event => { ... },
    currententrychange: () => { ... },
});
```

Also update the signal cleanup `on()` call (~line 93-100). The current pattern uses `on(signal, { abort: { once: true, listener: dispose } })`. Replace with standard DOM API:

```ts
// Before
on(signal, {
    abort: {
        once: true,
        listener: dispose,
    },
});

// After
signal?.addEventListener("abort", () => controller.abort(), { once: true });
```

In `NavigationEnhancer` constructor (~line 155), apply the same two patterns (primary listeners + signal cleanup).

- [ ] **Step 3: Update `src/assets/Navigator.tsx`**

Change:

```ts
handle.on(enhancer, {
    navigate(event) { ... }
});
```

To:

```ts
import { addEventListeners } from "remix/component";

addEventListeners(enhancer, handle.signal, {
    navigate(event) { ... }
});
```

- [ ] **Step 4: Evaluate built-in frame navigation**

Read the new `docs/frames.md` and `docs/handle.md` docs after they're fetched in Task 1. Check if the built-in frame navigation (`rmx-target`, `rmx-src`, `navigate()`, `link()` mixin) can replace our custom `NavigationEnhancer` and `Navigating` classes. If so, simplify:

- Check if anchors with `rmx-target="detail"` and `rmx-src="/frame/path"` would replace our custom interception logic
- Check if `navigate(href, { target })` replaces our imperative frame reload calls
- If the built-in system handles our use case, remove `NavigationEnhancer` from `src/lib/navigation.ts` and simplify `Navigator.tsx` to use the built-in APIs

Default to keeping `NavigationEnhancer` with updated APIs. Only remove if the built-in replacement is a clear drop-in. If uncertain, defer simplification to a follow-up task.

- [ ] **Step 5: Verify no legacy `on`/`connect` JSX props remain**

```bash
grep -rn ' on={' src/ && grep -rn ' connect={' src/ || echo "No legacy on/connect props found"
```

If matches are found, migrate to `mix={[on(...)]}` and `mix={[ref(...)]}` respectively.

- [ ] **Step 6: Run typecheck**

```bash
pnpm run typecheck
```

Fix any remaining type errors related to the interaction migration.

- [ ] **Step 7: Commit**

```bash
git add src/lib/navigation.ts src/assets/Navigator.tsx
git commit -m "Migrate from remix/interaction to remix/component APIs"
```

---

### Task 5: Fix fetch-router controller shape

**Files:**

- Modify: `src/routes/contacts.tsx`
- Modify: `src/routes/frames.tsx`
- Modify: `src/router.tsx` (verify)

- [ ] **Step 1: Update `src/routes/contacts.tsx`**

Wrap the default export in `{ actions: ... }`:

```ts
// Before
export default {
    show: contactPage,
    edit: contactPage,
    async create() { ... },
    ...
} satisfies Controller<typeof routes.contacts>;

// After
export default {
    actions: {
        show: contactPage,
        edit: contactPage,
        async create() { ... },
        ...
    },
} satisfies Controller<typeof routes.contacts>;
```

Also update `BuildAction` generic — remove the request method:

```ts
// Before
export const contactPage: BuildAction<"GET", typeof routes.contacts.show> = ...

// After
export const contactPage: BuildAction<typeof routes.contacts.show> = ...
```

- [ ] **Step 1b: Migrate `formData` access in action handlers**

The `context.formData` property was removed. Action handlers that destructure `formData` directly may need to use `context.get(FormData)` instead. Check the updated `docs/fetch-router.md` for the new handler signature. If `formData` is no longer a direct property:

```ts
// Before
async favorite({ params, formData }) {
    const update = await updateContact(Number(params.id), {
        favorite: formData.get("favorite") === "true",
    });

// After (if formData is no longer a direct property)
async favorite(context) {
    const formData = context.get(FormData);
    const update = await updateContact(Number(context.params.id), {
        favorite: formData.get("favorite") === "true",
    });
```

Apply the same pattern to the `update` action handler.

- [ ] **Step 1c: Verify no `{ action: fn }` object form is used**

Confirm that no Action object form with an `action` property is used in the codebase:

```bash
grep -rn 'action:' src/routes/ | grep -v 'action=' | grep -v '//'
```

If found, rename `action` to `handler` per the upstream breaking change. Current code uses function values directly in controller objects, so this likely does not apply.

- [ ] **Step 2: Update `src/routes/frames.tsx`**

Same controller shape change — wrap in `{ actions: ... }`:

```ts
export default {
    actions: {
        async sidebar({ url }) { ... },
        zero() { ... },
        async edit({ params }) { ... },
        async show({ params, url }) { ... },
    },
} satisfies Controller<typeof routes.frame>;
```

- [ ] **Step 3: Verify `src/router.tsx`**

Check that `router.map(routes.contacts, contacts)` still works with the new controller shape. The `router.map()` API expects the new `{ actions, middleware? }` shape, which we're now providing.

- [ ] **Step 4: Run typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/contacts.tsx src/routes/frames.tsx src/router.tsx
git commit -m "Update controller shape to { actions } format"
```

---

### Task 6: Fix data-table API changes

**Files:**

- Modify: `src/lib/database/contacts.ts`
- Verify: `src/lib/database/middleware.ts`
- Verify: `src/lib/database/seed.ts`

- [ ] **Step 1: Read current database files**

Read `src/lib/database/contacts.ts`, `src/lib/database/middleware.ts`, and `src/lib/database/seed.ts` to understand exact usage.

- [ ] **Step 2: Update `src/lib/database/contacts.ts`**

Rename `createTable` → `table`:

```ts
// Before
import { createTable, type TableRow } from "remix/data-table";

// After
import { table, type TableRow } from "remix/data-table";
```

Update table definition to use new `column(...)` builders. Read `docs/data-table.md` for exact new syntax.

- [ ] **Step 3: Verify `src/lib/database/middleware.ts`**

Check if `createDatabase` still works or needs to change to `new Database(...)`. The changeset says `createDatabase` still works as a convenience wrapper.

- [ ] **Step 4: Run typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/database/contacts.ts src/lib/database/middleware.ts src/lib/database/seed.ts
git commit -m "Update data-table API: createTable → table, column builders"
```

---

### Task 7: Fix resolveFrame signature changes

**Files:**

- Modify: `src/lib/render.tsx`
- Modify: `src/assets/entry.tsx`

- [ ] **Step 1: Update server-side `resolveFrame` in `src/lib/render.tsx`**

The `resolveFrame` callback now receives additional parameters:

```ts
// Before
renderToStream(node, {
    async resolveFrame(src) {
        ...
    },
})

// After — check docs/server-rendering.md for exact new signature
renderToStream(node, {
    async resolveFrame(src, signal, context) {
        ...
    },
})
```

Read `docs/server-rendering.md` for the exact `ResolveFrameContext` shape and whether `frameSrc`/`topFrameSrc` need to be passed to `renderToStream()`.

- [ ] **Step 2: Update client-side `resolveFrame` in `src/assets/entry.tsx`**

```ts
// Before
run(document, {
    async loadModule(moduleUrl, exportName) { ... },
    async resolveFrame(src) {
        const response = await fetch(src, { headers: { accept: "text/html" } });
        return await response.text();
    },
});

// After — check docs/hydration.md for exact new signature
run(document, {
    async loadModule(moduleUrl, exportName) { ... },
    async resolveFrame(src, signal, target) {
        const response = await fetch(src, { headers: { accept: "text/html" }, signal });
        return await response.text();
    },
});
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/render.tsx src/assets/entry.tsx
git commit -m "Update resolveFrame signatures for new component API"
```

---

### Task 8: Final verification and cleanup

**Files:** All modified files.

- [ ] **Step 1: Verify files marked as "Verify" in file map**

Check that these files still compile correctly and don't need changes:

- `src/lib/frame-router/core.ts` — uses `Handle` from `remix/component`, `Route` from `remix/fetch-router/routes`, `ArrayMatcher` from `remix/route-pattern`
- `src/frames.ts` — uses frame-router core
- `src/components/Document.tsx` — uses `Frame` from `remix/component`, check if new attributes like `rmx-target` are needed on forms/anchors

```bash
pnpm run typecheck
```

Fix any remaining errors.

- [ ] **Step 2: Run lint and format**

```bash
pnpm run lint
pnpm run fmt
```

- [ ] **Step 3: Commit docs**

Now commit the documentation changes from Task 1:

```bash
git add docs/
git commit -m "Replace local docs with current upstream documentation"
```

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "Fix remaining lint/format issues from API update"
```

- [ ] **Step 5: Final smoke check**

Review all changes with `git log --oneline` and `git diff HEAD~N` to verify everything looks clean.
