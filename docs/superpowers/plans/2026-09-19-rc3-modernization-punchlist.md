# rc.3 Modernization Punchlist

**Goal:** Retire the alpha-era conventions in this app that Remix 3 has since absorbed into the framework, and align file layout with the canonical Bookstore demo.

**Reference:** `remix-run/remix` @ `bfdf7ab` (`Release v3.0.0-rc.3`) — `demos/bookstore`, `demos/frame-navigation`, `template/`, `docs/guides/app/actions/docs/chapters/*.md`.

**Out of scope — permanently:** the runtime `remix/assets` asset server (`createAssetServer`, `app/middleware/asset-entry.ts`, `app/assets.ts`, `<ImportMap>`). This app bundles via `@pitlane/dev` for Cloudflare Workers. Every canonical pattern below has been checked for separability from `remix/assets`.

---

## Status: P1, P2, and P3 — DONE

| Commit    | Scope                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| `c68c9ee` | rc.3 upgrade + `unsafeHTML()`                                                    |
| `81f506d` | P1 — `render()` middleware, metadata teardown, `frameTarget()`, `uploadErrors()` |
| `61dff01` | P2 — native form navigation, pending-state, `link()` narrowing                   |
| `3e38856` | P3 — canonical file layout                                                       |
| `1a4582a` | Cookbook rewrite + `resolveFrame` redirect fix                                   |

Deviations from the plan below, with reasons:

- **P2 #6 (metadata) shrank rather than being deleted, and took a different shape than sketched.** The plan proposed a client helper reading a marker from the swapped DOM. Instead `Document` takes `title`/`description` props (canonical) and the detail frame carries metadata on percent-encoded response headers that `resolveFrame` applies. 16 files and 9 tests became 2 files and 1 test.
- **P2 #7 (`Navigating`) shrank rather than being deleted.** `SearchBar` moved to local state via `await navigate()`, but sidebar items need a broadcast that frame events cannot provide: when one item becomes active, the item _losing_ active state must also re-render, and it never received the click. `app/utils/pending-navigation.ts` (~55 lines) replaces the 111-line state machine.
- **P2 #8 (`link.tsx`) deleted outright.** First narrowed to submit buttons on the reasoning that `ButtonHTMLProps` omits `data-rmx-*`. That was solving the wrong problem: the canonical shape puts `data-rmx-target` on the **`<form>`**, not the submitter, and `FormHTMLProps` declares it. Submitter-level attributes only matter when one form's buttons target _different_ frames, which this app never does. The app now owns no link mixin — two plain typed props, one anchor and one form.
- **Optimistic writes re-sync with `frame.reload()`, not `navigate()`.** `favorite-button.tsx` re-navigated to the current URL after its `fetch`, which re-rendered the whole document, ran a history-rewriting transition, and reset scroll (`resetScroll` defaults to `true`). It now awaits `handle.frame.reload()` plus `handle.frames.get("sidebar")?.reload()` — the two regions the write actually invalidates — matching `demos/bookstore/app/actions/fragments/public/cart-button.tsx`. The search form also gained `data-rmx-target="sidebar"` so an Enter-key submit lands in the same frame the typing handler does.
- **P1 #5 ordering mattered.** `rescueResponses()` was load-bearing, because `formData()` re-throws whatever `uploadHandler` throws. The throw idiom was fixed first, then the middleware replaced.
- **`render({ assets })` proved unnecessary.** `@pitlane/dev`'s `clientEntryTransform` rewrites `clientEntry(import.meta.url, X)` to a public chunk URL in server environments, so the entry id is never a `file:` URL.
- **One bug found and fixed while documenting:** `resolveFrame` returned `response.body`, but the runtime derives `redirectedTo` only from a returned `Response`'s `redirected`/`url`, so POST-then-redirect left the action URL in the address bar.

## **P4 partially done:** README version link and RESTful-forms wording, the stale `resolveFrame` doc signature (died with the subsystem), the `favorite!` non-null assertion, and the formatter's `.claude` → `.agents` ignore path. **Still open:** the 14 `as` casts (8 in `app/data/adapters/r2-file-storage.ts`, plus `as any` and `let r2Options: any`), controller/action test coverage, re-vendoring `.agents/docs/remix/*.md` from rc.3, and `db/seed.ts` format drift.

## Status: rc.3 upgrade — DONE

Committed as `c68c9ee`. `remix` `3.0.0-rc.1` → `3.0.0-rc.3`.

The entire rc.1 → rc.3 jump produced **exactly one** compile error, now fixed:

- `ui@0.10.0` **BREAKING**: raw-HTML props require an opaque `unsafeHTML()` value. `app/utils/metadata/head.tsx` used `innerHTML={html…}` with a plain string. Fixed; the two template-stripping regexes were hoisted to module scope in the same edit (repo rule: compile regexes once).

Verification: `tsc --noEmit` clean; `remix test` 30/30 pass; `vp lint` 0 warnings/0 errors.

Remaining rc.1 → rc.3 breaking changes, all **non-applicable** (verified by import grep, not omission):

| Change                                             | Package                    | Why N/A                                                                                |
| -------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| Unmounted named `<Frame>` nav → full document nav  | `ui@0.10.0`                | `app/components/Document.tsx:56-57` mounts both `sidebar` and `detail` unconditionally |
| Default browser `resolveFrame` is same-origin-only | `ui@0.10.0`                | App always supplies its own `resolveFrame`                                             |
| Dotted strings in `eq()/ne()/gt()/…` are scalars   | `data-table@0.6.0`         | Zero usage of those operators                                                          |
| `Cookie.secure` returns `undefined` when unset     | `cookie@0.7.0`             | `remix/cookie` not imported                                                            |
| Session cookie lifetime enforced before load       | `session-middleware@0.5.0` | No session middleware                                                                  |
| `tar-parser` path policy + size limits             | `tar-parser@0.8.0`         | Not imported                                                                           |
| Asset fingerprint / `getScriptEntry()`             | `assets@0.7.0`             | Excluded convention                                                                    |

One behavioral change to spot-check: **`fetch-router@0.22.0` now returns `405 + Allow`** instead of falling through to 404 when a path matches but the method does not, and auto-serves `HEAD` from `GET`. No code change required — just confirm nothing branches on the old 404.

Only new subpath since rc.1 is `./multiple-import-maps-polyfill`, which is `remix/assets`-specific. Not adopted.

`@pitlane/data-table-d1@0.2.0` and `@pitlane/dev@0.6.0` both declare `peerDependencies.remix: ^3.0.0-rc.1`, satisfied by rc.3 under semver prerelease matching. The `DatabaseDriver` contract the D1 adapter implements is unchanged since `data-table@0.4.0`. No adapter work needed.

---

## P1 — Framework now owns this; delete our copy

### 1. Delete the form-navigation interceptor in `app/entry.browser.tsx`

**Delete lines 6-51** (the first `navigation.addEventListener("navigate", …)` block).

`run()` has owned this since the runtime grew `startNavigationListener` (`packages/ui/src/runtime/navigation.ts:121`) plus `createFormNavigationResolver` (`packages/ui/src/runtime/form-navigation.ts:46`). The native path is a strict **superset** of ours:

- Reads `data-rmx-target` / `-src` / `-reset-scroll` / `-history` / `-document` for **anchors and forms alike** (`navigation.ts:548-581`).
- Honors submitter `formmethod` / `formenctype` overrides (`form-navigation.ts:159-184`) — we ignore these.
- Handles `text/plain` and urlencoded body encoding — we always send `FormData`.
- Follows POST redirects and re-issues a reconciling navigation (`navigation.ts:191-224`).
- Implements the Chromium `NavigationPrecommitController` / Safari replay dance (`navigation.ts:234-260`) — we have nothing equivalent.

**This block is also an active bug.** Our POST path calls a bare `fetch()` (`entry.browser.tsx:29-33`) that bypasses our own `resolveFrame`, so POSTs never carry the `x-remix-frame` / `x-remix-target` headers that `resolveFrame` sets for GET. Server code keyed on those headers cannot currently see a POST frame submission. Deleting the block fixes this for free.

**Keep lines 92-115** — the `focusReset: "manual"` listener. `focusReset` appears **nowhere** in `packages/ui/src`, `demos/`, or `docs/`. This is a genuine gap-filler for the search input, correctly registered after `run()` so its `intercept()` wins. Not obsolete.

### 2. Delete `app/utils/render.tsx`; install `render()` middleware

Add `render()` from `remix/middleware/render` as the **last** entry in the `app/entry.server.tsx` middleware array, then replace every `render()` / `renderDocument()` / `frame()` call with `context.render(node, init?)`.

`packages/render-middleware/src/lib/render-ui.ts` does everything our 45-line file does, plus everything it forgets:

| Capability                                 | `render-ui.ts`            | `app/utils/render.tsx` |
| ------------------------------------------ | ------------------------- | ---------------------- |
| Forward cookies/auth to frame sub-requests | `:120-124`                | missing                |
| Strip hop-by-hop + `sec-fetch-*` headers   | `:16-33`, `:129-131`      | missing                |
| Coerce frame sub-requests to `GET`         | `:161`                    | missing                |
| Follow redirects (20 hops)                 | `:14`, `:154-176`         | missing                |
| Cross-origin header trimming               | `:36-44`, `:182-190`      | missing                |
| Propagate abort signal into frame stream   | `:75`, `:109-112`, `:163` | missing                |
| `onError` hook                             | `:69`                     | missing                |

It also removes a circular import: `render.tsx:3` statically imports `router` from `#/entry.server.tsx`. Canonical reads `context.router`, a per-request self-reference the router injects (`packages/fetch-router/src/lib/request-context.ts:350`).

`createFrameResponse` duplicates `createHtmlResponse` — which `contacts.tsx:20` and `controller.tsx:9` **already** import directly as `html`. Two parallel HTML-response constructors today; canonical has one.

**The `assets` option is not needed — verified, not assumed.** `render({ assets })` only matters when a `clientEntry()` source id still starts with `file:` at render time (`render-ui.ts:203-207`). `@pitlane/dev`'s `clientEntryTransform` rewrites `clientEntry(import.meta.url, X)` at transform time: in server environments to `___clientEntryAssets.entry + "#X"` (a public chunk URL), in the client environment to `import.meta.url + "#X"` (`node_modules/@pitlane/dev/dist/index.mjs:842-857`). The id is never `file:`-prefixed at runtime, so plain `render()` is safe. No asset shim, no `remix/assets`.

`asyncContext()` stays in the stack — `render()` never uses it, but `sidebar.tsx:9` and any future deep helper still call `getContext()`, exactly as `demos/bookstore/app/router.ts:83` keeps it.

### 3. Drop the document-vs-frame render split

There is no framework-level split at rc.3. The same `context.render(node)` produces a fragment or a full document based purely on whether the tree contains an `<html>` tag — `context.flushKind` flips to `'document'` when the renderer walks one (`packages/ui/src/server/stream.ts:501-503`). Every canonical controller returns full pages and bare fragments through one identical call.

What stays is the **controller-level** choice of what to build. Our 3-way `sidebar` / `detail` / document branch is a legitimate canonical pattern (container-frame branching, as in `demos/frame-navigation/app/actions/main/controller.tsx:42-45`) — but it is currently duplicated verbatim in `app/actions/controller.tsx:50-56` and `app/actions/contacts.tsx:26-41`. Collapse to one helper.

### 4. Pair `x-remix-target` checks with `x-remix-frame === "true"`

`app/actions/controller.tsx:52-53` and `app/actions/contacts.tsx:27` test `x-remix-target` alone. Every canonical controller tests both, so a stray `X-Remix-Target` on a top-level navigation cannot serve fragment content as a whole page. The middleware itself pairs them (`render-ui.ts:69`). Defense-in-depth; low exploitability since both are app-controlled same-origin headers.

### 5. Remove `rescueResponses()` by fixing the throw idiom

`throw new Response(...)` has **zero upstream precedent**. `fetch-router` never catches thrown Responses — `runMiddleware`'s `dispatch()` has no try/catch at all (`packages/fetch-router/src/lib/middleware.ts:107-140`); the only `instanceof Response` check is on a middleware's _return_ value (`:132-135`). Canonical always returns a Response; where a helper must signal failure it returns `T | Response` and the caller does `if (x instanceof Response) return x` (`demos/timeboxer/app/actions/schedules/controller.tsx:84`).

**Order matters here:** `rescueResponses()` is load-bearing _today_, because `formData()` re-throws whatever `uploadHandler` throws (`packages/form-data-middleware/src/lib/form-data.ts:78-83`). Removing the middleware first would turn a 415 into a 500.

Fix the source instead: `uploadHandler` (`app/actions/controller.tsx:36-39`) should return `undefined` for a disallowed MIME type — exactly as it already does for empty files (`:31-33`) — and the action should detect the missing avatar field and return `new Response(…, { status: 415 })`. Then delete `rescueResponses()`. Canonical `uploadHandler` never throws (`demos/bookstore/app/middleware/uploads.ts:5-12`).

---

## P2 — Real gaps, but our solution is oversized

### 6. Shrink `app/utils/metadata/` — do not delete it

**The subsystem addresses a genuine runtime gap. Verified in both directions:**

- **Full-document swaps reconcile `<head>` natively.** `frame.ts:518-545` DOMParser-parses the response and runs `diffNodes([container.doc.head], [parsed.head], { shouldPreserveHeadNode })`. `packages/ui/src/test/frame.test.ts:64-92` asserts `document.title === 'Next'` after reload.
- **Client-rendered trees reconcile a literal `<head>` natively.** `isHeadHostNode` (`reconcile.ts:381-386`) portals any `<head>` vnode's children into the real `document.head` (`reconcile.ts:901-935`). Note: only a literal `<head>` element — bare `<title>`/`<meta>` siblings stay where rendered.
- **Partial/named frame swaps do NOT.** The fragment path builds content via `createFragmentFromString` → `template.innerHTML` (`frame.ts:1859-1862`), then calls `removeEmptyHeads` (`:576`), which only drops `<head>` elements with **zero children** (`:1150-1157`). Nothing hoists a non-empty nested `<head>` into the document. `shouldPreserveHeadNode` is wired only at the document-level call site (`:544`).

So per-frame `<title>` on a `detail`-frame swap is still app-owned. **But the implementation is wildly out of proportion to its use.** 16 files implementing owner-scoped keys, sticky/replaceable lifecycles, precedence buckets, React-19 `itemProp` rejection rules, a JSON `<template>` transport, and a `MutationObserver` reconciler — to serve exactly three call sites (`Document.tsx:44-46`, `EditContact.tsx:21-23`, `ShowContact.tsx:30-33`) that between them set a `<title>` and one `<meta name="description">`. No `<link>`, `<style>`, or `<script>` entry is ever produced, so all of `rules.ts` and most of `html.ts` is dead weight.

It also defeats streaming: `renderWithMetadata` buffers the **entire** SSR stream to splice the head, acknowledged in the subsystem's own `README.md:110-115`.

Plan:

- `Document.tsx`: replace `<Head><title>{SITE.title}</title></Head>` with a literal `<title>` in the existing `<head>`, or a `title` prop (`demos/bookstore/app/ui/document.tsx:8-22`, `template/app/actions/document.tsx:8-22`).
- Delete `rules.ts`, `html.ts`, `types.ts`, `README.md`, the barrel, and the matching tests.
- Replace `manager.ts` + `head.tsx` + `transport.ts` + `ssr.ts` + `stream.ts` with one small helper that sets `document.title` (plus optional meta description) when the `detail` frame resolves and reverts on teardown. No owner map, no precedence, no `MutationObserver`.
- Move `frames.ts` (`withMetadataFrames` / `normalizeFrameHtml`) to `app/utils/frames.ts` — it is frame-response body extraction, unrelated to metadata despite its folder.
- **Verify first with a throwaway repro**: confirm a `<head>`-wrapped block inside fetched partial-frame HTML really is not hoisted. The source reading above says no, but no upstream test falsifies it directly.

Delete the 6 metadata test files alongside the code they cover rather than re-pinning them. They assert `data-pitlane-metadata-*` attribute names, the owner/key/lifecycle model, and the JSON wire format — all 1:1 with the system being removed. Test _conventions_ need no migration; they already use `remix/test` + `remix/assert` like upstream's own suites.

### 7. Replace `app/utils/navigating.ts` per call site

rc.3 deliberately ships **no** app-wide navigation-state bus. The canonical pending primitive is per-frame: `FrameHandleEventMap = { reloadStart, reloadComplete }` (`packages/ui/src/runtime/component.ts:163-166`), dispatched around every reload path (`frame.ts:802-803`, `:911-912`), read via `handle.frames.top` / `handle.frame` / `handle.frames.get(name)`. Real usage: `demos/frames/app/actions/frames/public/reload-time.tsx:8-21`, `demos/spa/app/components.tsx:14-25`, `docs/shared/ui/public/docs-shell.tsx:68-71`.

`app.frames.top.src` is assigned `event.destination.url` **before** the reload starts (`navigation.ts:202`), so it is a synchronous read of the pending destination the moment `reloadStart` fires — which is what `navigating.to.url` is used for.

Migrate `SearchBar.tsx:2` and `SidebarItem.tsx:3,38-42`, then delete the file. `Navigating`, `DestinationChangeEvent`, and `NavigatingEventMap` already have zero external importers.

**Accept one real loss:** `reloadStart`/`reloadComplete` are bare `Event`s. Nothing upstream distinguishes a GET load from a POST submission mid-flight, so `navigating.to.state` (`idle`/`loading`/`submitting`) and `navigating.to.formData` have no canonical equivalent. Confirm neither call site depends on that distinction before deleting; if one does, track it locally at the triggering call site.

### 8. Delete `app/utils/link.tsx`

The comment at `link.tsx:5-6` ("Only created instead of `remix/ui.link()` to support button elements") is stale. `remix/ui`'s `link()` does handle button hosts now — but with _link_ semantics that would break a submit button: it forces `type="button"` (`link-mixin.ts:51-53`) and `preventDefault()`s the click to call `navigate()` (`:81-87`). So `link()` genuinely cannot serve our call site.

That is not a reason to keep a mixin, though — it is a reason not to put frame targeting on the button at all. The canonical shape is `data-rmx-target` on the **`<form>`** ([guides, "Navigate a frame with a form"](https://guides.remix.run/streaming-ui-with-frames/#navigate-a-frame-with-a-form)), and `FormHTMLProps` (`dom.ts:2303-2312`) declares the attributes, so it is a plain typed prop. `RestfulForm` spreads extra props onto its `<form>`, so it needs no change.

Submitter-level attributes exist — the runtime checks the submitter before the form (`form-navigation.ts:159-170`, tested at `frame.test.tsx:1288`) — but they only matter when one form's buttons target _different_ frames. This app has one button per form. `ButtonHTMLProps` (`dom.ts:2003-2069`) omitting `data-rmx-*` is then a non-issue rather than a typing gap to work around.

Do: move `data-rmx-target="detail"` onto the `RestfulForm` in `show-page.tsx`, pass it as a plain prop on the anchor in `sidebar-item.tsx` (matching `demos/frame-navigation/app/ui/nav-link.tsx:19-23`), and delete the file.

---

## P3 — Layout and naming (mechanical, zero behavior change)

Canonical layout (`docs/guides/…/02-routing-and-controllers.md:307-324`): _"Keep route-local UI next to the controller that renders it… Components shared by multiple route areas belong in `ui/`."_ All upstream filenames are **kebab-case**; exported identifiers stay PascalCase.

Our flat, PascalCase `app/components/` mixes all three categories:

| Current                      | Canonical destination                                                        | Note                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `components/Document.tsx`    | `ui/document.tsx`                                                            | Document/Layout split optional — everything renders through named Frames |
| `components/RestfulForm.tsx` | `ui/restful-form.tsx`                                                        |                                                                          |
| `components/SearchBar.tsx`   | `ui/search-bar.tsx`                                                          | Coupled to Document, not to a feature                                    |
| `components/ShowContact.tsx` | `actions/contacts/show-page.tsx`                                             |                                                                          |
| `components/EditContact.tsx` | `actions/contacts/form.tsx`                                                  |                                                                          |
| `components/ZeroState.tsx`   | `actions/zero-state.tsx`                                                     | Root-controller-owned                                                    |
| `components/SidebarItem.tsx` | `actions/contacts/public/sidebar-item.tsx`                                   | `clientEntry` widget                                                     |
| `components/Favorite.tsx`    | `actions/contacts/public/favorite-button.tsx`                                | `clientEntry` widget                                                     |
| `components/Buttons.tsx`     | split → `actions/contacts/public/delete-button.tsx` + `ui/cancel-button.tsx` | Canonical never bundles unrelated components                             |
| `actions/contacts.tsx`       | `actions/contacts/controller.tsx`                                            |                                                                          |
| `actions/sidebar.tsx`        | `actions/contacts/sidebar-frame.tsx`                                         | Keep the shared-helper shape; only relocate                              |

**Do not rename `app/entry.server.tsx` to `app/router.ts`** despite it being the canonical name. It is the Workers module entry (`wrangler.jsonc:4` `main`) and the target of `?assets=ssr` query imports. If the canonical name is wanted, add `app/router.ts` with the composition and leave `entry.server.tsx` as a thin re-export.

### 9. Fix the backwards import

`app/components/EditContact.tsx:5` imports `ALLOWED_TYPES` from `#/actions/controller.tsx` — UI reaching into the controller layer, and it drags in `controller.tsx`'s module-scope `new R2FileStorage(env.FILES)` Cloudflare-binding side effect. Extract `ALLOWED_TYPES` + `uploadHandler` + storage setup to `app/utils/uploads.ts` (`demos/bookstore/app/utils/uploads.ts`).

### 10. `RestfulForm` parity

Ours and upstream's are equally thin; `methodOverride()` did **not** absorb more logic. Optional additions from `demos/bookstore/app/ui/restful-form.tsx`: a `methodOverrideField` prop, `.toUpperCase()` normalization, and the `Props<'form'>` helper (`packages/ui/src/runtime/jsx.ts:88`) in place of `JSX.IntrinsicHTMLElements["form"]`. Keep our `method?: RequestMethod | "ANY"` typed against `routes.*.method` — that is a DRY win upstream doesn't have. Port the 11 colocated cases from `restful-form.test.browser.tsx`.

### 11. Do NOT swap in `remix/ui/button` / `input` / `combobox` for behavior

All three are **pure style mixins** with zero behavior. They do not replace `CancelButton`'s `navigation.back()`, `DeleteButton`'s confirm-then-submit, or `SearchBar`'s live search. Compose them for visual chrome only, if at all. Recorded to close the question.

---

## P4 — Housekeeping

- **Test coverage is inverted.** All 9 test files cover `app/utils/metadata/**`; there are **zero** tests for routes, middleware, actions, data, or components. Upstream colocates `controller.test.ts` beside nearly every controller plus `router.test.ts` and e2e specs. After P1 lands, add controller tests — not more metadata tests.
- `README.md:16` links `remix/v/3.0.0-beta.5`. Now three releases stale.
- `app/utils/metadata/README.md:42` documents a 4-positional-arg `resolveFrame(src, signal, target, context)` that matches neither the current server 3-arg nor browser 2-arg shape. Dies with item 6.
- `.agents/docs/remix/*.md` (55 vendored files) already document `data-rmx-history` / `data-rmx-document` / `data-rmx-preserve-dom`, which the app never uses — the docs are ahead of the code. Re-vendor from rc.3 after P1.
- Repo-rule violations worth a pass: 14 `as` casts (8 in `app/data/adapters/r2-file-storage.ts`, plus `as any` at `:84` and `let r2Options: any` at `:59`), and the sole non-null assertion `let favorite!: boolean` (`app/components/Favorite.tsx:12`).
- `db/seed.ts` has pre-existing format drift (`vp fmt --check` flags it). Left untouched to avoid mixing concerns.
- Dead exports to drop as their files are touched: `fakeNetwork` (`app/data/contacts.ts:94`), `createFrameResponse` base name, `LinkProps`, and ~25 of ~30 `app/utils/metadata/index.ts` barrel exports.

---

## Suggested order

1. **P1 #5** first — fix the `uploadHandler` idiom, then delete `rescueResponses()`. Independent, and unblocks clean error handling.
2. **P1 #2 + #3 + #4** as one change — install `render()`, delete `render.tsx`, collapse the duplicated target branch. Largest single win.
3. **P1 #1** — delete the interceptor. Smoke-test every POST + redirect flow; POSTs will carry `x-remix-frame`/`x-remix-target` for the first time.
4. **P2 #7**, then **#8**, then **#6** (the metadata shrink last — it is the only item needing a repro first).
5. **P3** as one mechanical rename commit, **P4** opportunistically.
