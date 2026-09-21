# Guides Conformance Punchlist

**Scope:** every chapter in `docs/guides/app/actions/docs/chapters/` of `remix-run/remix` @ `main` (`bfdf7ab`, identical to `v3.0.0-rc.3`), swept against this app. Report only — nothing here has been changed.

**Read this first — half the guides are drafts.** Only chapters 01–07, 13 and 16 are published. Chapters **08, 09, 10, 11, 12, 14, 15 carry `published: false`** and are 39–73-line outlines: section headings plus a one-paragraph summary, no code. Their advice is still a clear statement of intent (08 says outright: _"Prefer `parseSafe()` in actions when invalid input should become a `400` response"_), but "the guide says" carries less weight there than in a published chapter. Severity below reflects real impact, not chapter count.

**Permanently out of scope:** `remix/assets`. Items entangled with it are marked N/A and not counted.

---

## 0. Regressions I introduced earlier in this session

These are not guide divergences. They are defects I created while modernizing, and the sweep found them. Listing them first because they are the only items that make the app worse than it was.

### R1 — The global error banner renders completely unstyled · ~~high~~ · **DONE**

Rewriting `app/entry.browser.tsx` in `81f506d`, I retyped the banner markup and changed both hooks the stylesheet uses:

|         | Before                  | After                  |
| ------- | ----------------------- | ---------------------- |
| Root    | `id="app-error-banner"` | `class="error-banner"` |
| Message | `<p>`                   | `<span>`               |

`app/index.css:449-493` still targets `#app-error-banner`, `#app-error-banner p`, `#app-error-banner button`, `#app-error-banner button:hover`, `#app-error-banner button:active`. None match now, so ~45 lines of CSS are dead and the banner paints with no styling at all. Purely gratuitous — the rename bought nothing.

**Fixed.** Reverted to `id="app-error-banner"` and `<p>`, so the markup matches `app/index.css:449-493` again. Structure is now byte-identical to the pre-regression version apart from `{"\u00d7"}` in place of a literal `×`, which renders the same glyph and matches how `sidebar-item.tsx` escapes `\u2605`.

### R2 — A malformed contact id returned a server error instead of a response · ~~high~~ · **DONE (via H2)**

The pre-refactor `contactPage()` wrapped its whole body in `try { … } catch { return redirect(routes.home.href()); }`. I replaced that with an explicit `if (!contact)` null check (`81f506d`), which is better in isolation — the blanket catch also swallowed genuine database failures and disguised them as redirects — but I removed the catch without putting real validation handling in its place.

Verified: `s.parse(IdSchema, { id: "abc" })` throws `ValidationError`, and `/contacts/:id` matches any segment.

```
"12"  -> {"id":12}
"abc" -> THROWS ValidationError
""    -> THROWS ValidationError
```

So `/contacts/abc` used to redirect home and then threw with nothing catching it anywhere.

**Fixed** by H2 below, not by restoring the blanket catch. A malformed id is now an explicit `400`.

---

## 1. High

### H1 — Nothing catches a thrown error, anywhere · ch03:156-163, ch12 · **DONE**

`app/entry.server.tsx:35` is `export default router;` — no `fetch` wrapper, no `try`/`catch`. `render()` is called with no `onError`. The only catch in the server is `uploadErrors()`, which matches exactly one error type.

Chapter 3 names this precisely for our runtime: _"Add a `try`/`catch` around `router.fetch(...)` when the runtime's default error response and logging are not what the app needs."_ Given H2, the app definitely needs it.

Today an uncaught throw becomes workerd's generic error page. Worse, it round-trips: the client's `resolveFrame` throws on `!response.ok` using the response body as the message, so the platform's error HTML gets rendered verbatim into the app's own error banner.

**Fixed.** Two changes in `app/entry.server.tsx`:

- `export default router` became the guide's Workers shape — `export default { async fetch(request) { … } } satisfies ExportedHandler` — wrapping `router.fetch()` in a `try`/`catch` that returns a plain `500`. The abort guard is the canonical one from `demos/bookstore/server.ts:11-17`: `if (!(request.signal.aborted && error === request.signal.reason))`, so a client disconnect is treated as cancellation rather than logged as a server failure (ch12, "Treat request aborts as cancellation").
- `render()` now takes `onError`, per ch12's "Report streaming render failures". The middleware already passes `request.signal` and suppresses `onError` for its own internal frame sub-requests, so it reports once per request rather than once per frame.

The `?assets=ssr` query import in `document.tsx` reads build metadata, not module exports, so the changed default export doesn't affect it; the named `router` export is retained.

Verified by building and reading the emitted Worker — the boundary survives bundling intact and the entry is still a valid Workers handler:

```js
var worker_entry_default = { async fetch(request) {
    try {
        return await router.fetch(request);
    } catch (error) {
        if (!(request.signal.aborted && error === request.signal.reason)) console.error(error);
        return new Response("Internal Server Error", { status: 500 });
```

Runtime confirmation still needs a real failing request — see the smoke-test note. A regression test remains blocked by **M3**.

### H2 — `s.parse()` everywhere; `parseSafe()` nowhere · ch01:591-596, ch08 · **DONE**

Nine call sites use the throwing `parse()`: seven in `app/actions/contacts/controller.tsx` (lines 45, 69, 88, 93, 94, 101, 108) plus `app/actions/sidebar.tsx:16` and `app/ui/document.tsx:27`. Chapter 1's own edit action uses `parseSafe` specifically so it can respond instead of throw; chapter 8 states the rule directly. `parseSafe` exists and is exported.

This is the root cause of R2. Note the honest counterweight: `demos/bookstore` never implements the full "re-render the form with field errors" pattern either, so the _reachable_ target is returning a clean `400`/`404`, not a polished error UI.

**Fixed.** All nine throwing `s.parse()` call sites across `app/` are gone; `grep 's\.parse('` now returns nothing. Two shapes, chosen by what the value means:

- **Identifiers and mutation payloads → an explicit `400`.** A controller-local `contactId(params)` returns `number | Response`, and callers do `if (id instanceof Response) return id` — the same shape `demos/timeboxer/app/actions/schedules/controller.tsx:84` uses. `FavoriteSchema` and `UpdateSchema` each return their own `400`.
- **The `q` search filter → no filter.** `searchQuery(url)` in `app/data/schemas.ts` falls back to `undefined`. Narrowing a list is neither an identifier nor a payload, so the useful answer is the unfiltered list, not a client error. It also removes the last duplicated `QuerySchema` parse across the controller, `sidebar.tsx`, and `document.tsx` — and `document.tsx` is a component that cannot return a `Response` at all.

Verified every previously-throwing input now resolves cleanly:

```
IdSchema        "12" -> 12      "abc" -> 400    "" -> 400    "-3" -> -3
FavoriteSchema  true -> true    banana -> 400
searchQuery     (none) -> undefined   ?q=ada -> "ada"   ?q=a&q=b -> "a"
```

No permanent test was added. The real contract is "`GET /contacts/abc` returns 400", which needs a router-level test that **M3** currently blocks; and a test for `searchQuery`'s fallback would be a tautology, since `QuerySchema` cannot actually fail. Revisit when M3 is resolved.

### H3 — Uploaded SVGs are a stored-XSS vector · ch11 · **DONE (by Orion, `b4c4dd8`)**

`image/svg+xml` was allowlisted, and the `uploads` action streams files back inline from the app's own origin with no `Content-Disposition`. An SVG containing `<script>` does **not** execute through the `<img>` tag on the contact page, but it _does_ if anyone opens `/uploads/avatar/…​.svg` directly — same-origin, so it can reach anything the origin can.

**Fixed** by dropping `image/svg+xml` from the allowlist, which costs nothing for avatars. The other options — `Content-Disposition: attachment`, a separate origin, or sanitising on upload — remain available if SVG avatars are ever wanted.

Two loose ends in adjacent code were cleaned up afterwards: `uploadErrors()`'s 415 message still listed SVG among the accepted formats, and `image-types.test.ts` carried a now-dead SVG fixture. The allowlist test now pins the rejection explicitly, so re-adding SVG fails a test rather than silently reopening the hole.

### H4 — The favorite toggle is broken without JavaScript · ch09 · **DONE**

`FavoriteButton` is a `clientEntry`, so the server renders a real `RestfulForm`. Submitted with JS disabled (or before hydration) the `favorite` action returned `Response.json(update)` — the browser navigated to a page of raw JSON and the user lost the app.

Chapter 9's whole framing is HTML-first: _"Build the mutation as an HTML form and controller action first. Once the non-JavaScript request returns the right response, the same form can gain pending state…"_ This was the inverse — the enhanced path worked and the baseline didn't.

**A second defect surfaced while fixing it.** The response type was only half the problem. The button submitted `value={favorite ? "true" : "false"}` — the state it _had_ — and `updateContact` writes an absolute value rather than toggling. So an unenhanced submission wrote back the value already stored: **a silent no-op**, independent of the response.

It worked under JavaScript only by accident of render ordering: the handler flipped `favorite`, awaited `handle.update()`, and _then_ built `FormData` from the re-rendered DOM, which by that point held the flipped value. That also meant the payload depended on the reconciler patching the submitter node in place — had it replaced the node, `event.submitter` would have been detached and contributed nothing.

**Fixed** in three parts:

1. **The payload is now the desired next state.** `value={favorite ? "false" : "true"}`, and `FormData` is captured from `event.currentTarget` _before_ the optimistic re-render. Both paths now send the same thing, and correctness no longer depends on a render having committed. Capturing the form first also fixes a latent issue: `currentTarget` is only valid during dispatch, yet `.action`/`.method` were being read after an `await`.
2. **The action content-negotiates**, per ch06:270 — _"The action should return HTML for the targeted frame when it receives a frame request, while keeping its normal document response or redirect for unenhanced submissions."_ A frame request gets `204 No Content`; anything else gets a POST/Redirect/GET back to the contact.
3. **The client identifies itself.** Its bare `fetch` sent no frame headers, so the action could not tell the paths apart; it now sends `x-remix-frame` and `x-remix-target`.

`204` rather than always redirecting because `fetch` follows redirects by default, so the enhanced path would otherwise download the whole contact page on every star click and discard it — the client never reads the body.

The action also gained the missing `getContact` existence check. `updateContact` throws `Error("Contact with id N not found")` for a missing id, which since H1 is a clean 500 but should be a redirect.

Covered by `app/actions/contacts/favorite-button.test.browser.tsx` — the first component test in the repo, and proof that **M4** is actionable today: these `clientEntry` components have no `cloudflare:workers` coupling and render fine under `remix/ui/test`. The test was checked against the pre-fix expression and fails on it.

### H5 — Both `staticFiles()` middlewares are dead weight on Workers · ch03:165 · **DONE**

Chapter 3 calls this out by name: _"the current static-file and compression middleware use Node filesystem and compression APIs. On a worker, serve static assets through the platform."_

Verified end to end:

- `remix/middleware/static` imports `node:fs/promises` (`static.ts:2`). Under `nodejs_compat` that is an ephemeral per-request virtual filesystem, not the bundled tree.
- `wrangler.jsonc:5` already declares `"assets": { "directory": "dist/client" }`, and Cloudflare serves assets _before_ the Worker by default.
- `dist/client/` already contains `favicon.ico`, `favicon.svg`, `favicon-180.png` — Vite copies `public/` into the build output.

So `staticFiles("./dist/client")` is unreachable in production and `staticFiles("./public")` is redundant with it. Both still cost a middleware hop per request.

**Fixed.** Both calls and the `remix/middleware/static` import are gone.

The pre-deploy `curl` turned out to be unnecessary: the build emits the deploy config the platform actually uses, and it settles the question. `dist/ssr/wrangler.json` contains `"assets": { "directory": "../client" }` with **no `run_worker_first`**, so Cloudflare serves matching paths ahead of the Worker — the middleware was unreachable for exactly the paths it existed to serve. `dist/client/.assetsignore` excludes only `wrangler.json` and `.dev.vars`, and all three favicons are present in `dist/client/`, so nothing lost a server.

Measured effect on the Worker bundle:

|      | Before   | After    |
| ---- | -------- | -------- |
| Raw  | 458.2 kB | 388.6 kB |
| gzip | 111.6 kB | 93.6 kB  |

`node:fs/promises` and `node:path` are now absent from the bundle entirely — the Worker has no filesystem dependency left. Note this does **not** make `nodejs_compat` removable: `node:async_hooks` (from `asyncContext()`) and `node:timers/promises` (from `fakeNetwork()` in `app/data/contacts.ts`) both remain.

---

## 2. Medium

### M1 — Missing records redirect home instead of returning 404 · ch01:297,311-313; ch02:229 · **DONE**

`contactPage()` and `update` both `redirect(routes.home.href())` when a contact was absent. Every equivalent branch in `demos/bookstore` returns a 404. A stale bookmark yielded a `200` after the redirect, misleading crawlers, link checkers and non-browser clients.

**Fixed.** A `contactNotFound(ctx)` helper returns the 404 in whichever shape was asked for — the `ContactNotFound` fragment for a `detail` frame request, otherwise a whole `<Document>` at `status: 404`. Used by `show`, `edit` and `update`.

The two shapes compose rather than duplicating: the document-level 404 renders `<Document>`, whose `detail` frame sub-requests the same URL with `x-remix-frame: true` and comes back with the fragment. No recursion, because the sub-requests always take the fragment branch. The `sidebar` sub-request is unaffected and still returns its list at 200 — the collection exists even when one member doesn't.

Two supporting changes were needed to make a 404 _render_ rather than blow up:

- **`render()` middleware already cooperates.** `render-ui.ts:108-116` streams a non-OK frame response's body as content and only throws when the body is null, so an application 404 page survives frame embedding.
- **The browser resolver did not.** `entry.browser.tsx` rejected every non-`ok` response, so a client-side navigation to a deleted contact would have hit the error banner instead of showing the page. It now follows the documented policy of the runtime's own default resolver (`component.ts:150-157`) — _"accepts 2xx responses and 3xx or 4xx HTML responses. It rejects other 3xx or 4xx responses and all 5xx"_. Plain-text failures (400/413/415) still reach the banner; HTML pages render.

`favorite` returns a bare `404` instead of a page: both of its callers read only the status, so rendering a document there would be waste. `destroy` still redirects home — deleting something already gone and landing on the list is the right outcome, not an error.

### M2 — Uploads: no size limits, and the MIME type is taken on trust · ch11 · **DONE**

`formData({ uploadHandler })` set none of `maxFileSize` / `maxFiles` / `maxTotalSize` / `maxParts`, so the library defaults applied (≈2 MB per file, 20 files, `maxFileSize * 20 + 1 MiB` total). `uploadHandler` checked `file.type`, the client-declared multipart header, and derived the storage key's extension from the unsanitized `file.name`.

**Fixed** with explicit caps and a two-signal type check:

| Limit          | Value |
| -------------- | ----- |
| `maxFileSize`  | 5 MB  |
| `maxFiles`     | 1     |
| `maxTotalSize` | 6 MB  |
| `maxParts`     | 20    |

A breach no longer becomes a 500. `uploadErrors()` now maps the five `Max*ExceededError` types to **413**, and any other `MultipartParseError` / `FormDataParseError` — a malformed body rather than a server fault — to **400**.

**Read this before trusting the type check.** `remix/mime` does **not** sniff content. `detectMimeType(name)` is a pure extension→MIME lookup; nothing in the package reads bytes. So "the real MIME type" is not available from it, and the app still cannot prove what a file contains. What changed is that **two independent client-supplied signals must now agree** — the multipart `Content-Type` and the filename's extension — and both must land in the allowlist. That rejects the mismatch shapes (`evil.svg` declared `image/png`, and the reverse) but a renamed file whose header matches its extension still gets through. Real verification needs magic-byte sniffing, which would be a separate change.

The storage key's extension now comes from the allowlist rather than the filename, so `evil.j/pg` can no longer smuggle a path segment into the key.

Two structural notes:

- The pure decision moved to `app/utils/image-types.ts` (`imageExtension`, `ALLOWED_TYPES`). `app/actions/contacts/form.tsx` had been importing `ALLOWED_TYPES` from `utils/uploads.ts`, which meant a UI component transitively pulled in `cloudflare:workers` and a module-scope `new R2FileStorage(env.FILES)` just to read six strings. The split removes that and makes the security-relevant logic testable despite **M3** — pinned in `app/utils/image-types.test.ts`.
- **Cost:** bundling `remix/mime` grew the Worker from 388.6 kB to 435.2 kB raw (93.6 → 106.5 kB gzip, **+12.9 kB**) for its generated mime-db table, to resolve six extensions. Hardcoding the reverse map would reclaim that and drop a dependency; using the package is the more conventional choice. Worth revisiting if Worker start-up size ever matters.

Still open from this area: `file.fieldName` is interpolated into the storage key unvalidated. R2 keys are flat so it is not traversal, and `UpdateSchema`'s `UPLOAD_PATH` refine rejects the resulting href, but a forged part name can still write an oddly-keyed orphan object.

### M3 — Router-level tests are structurally impossible today · ch13 · **DONE**

Chapter 13's primary server-test boundary is `router.fetch(...)`, and it could not be reached:

```
import('./app/utils/uploads.ts')  -> ERR_UNSUPPORTED_ESM_URL_SCHEME  (protocol 'cloudflare:')
```

`app/middleware.ts` and `app/utils/uploads.ts` bind `cloudflare:workers` `env` at module scope, and `app/entry.server.tsx` builds the router as an eager singleton. `remix test`'s server runner is plain `node:worker_threads`, so the import failed before any test ran.

**Resolved by changing the runner rather than the app.** Rather than adding a `createAppRouter(options)` seam to dodge the Workers runtime, the tests now run _inside_ it: Vitest plus `@cloudflare/vitest-plugin`, which executes the suite in workerd against the real `wrangler.jsonc` bindings. `cloudflare:workers` resolves because it genuinely exists, and no dependency injection is needed — the eager singleton is exercised exactly as deployed.

What that took:

- **Two projects.** Workerd has no DOM, so `vitest.config.ts` defines a `worker` project (`@cloudflare/vitest-plugin`) and a `dom` project (`jsdom`) split on the existing `*.test.browser.*` naming.
- **The app's Vite plugins in both.** `@pitlane/dev`'s `remix()` supplies `clientEntry()`, `?assets=ssr` and `pitlane:dev`; without it the router's module graph will not import. Its component-HMR plugins rewrite modules to reach a dev-server registry that no test runtime provides, so the `dom` project filters those two out.
- **Real D1.** `readD1Migrations()` reads the generated SQL in Node at config time and passes it as a binding; a setup file applies it with `applyD1Migrations()`, since workerd has no filesystem. `vp run test` now depends on `db:migrations:generate`, so schema and tests cannot drift.
- **`NODE_ENV=test` as a Miniflare binding.** `fakeNetwork()` sleeps 1–3s per uncached call unless it sees that, and workerd does not set it. Suite time went from **9.1s to 1.6s**.
- **`remix test` retired.** `remix.json` existed only for its globs and is deleted; assertions moved from `remix/assert` to Vitest's `expect`.

Integration tests now drive the deployed entry through `exports.default.fetch()` from `cloudflare:workers` — the documented replacement for the deprecated `SELF`. `app/router.test.ts` covers the 400/404/redirect/204 contracts that H1, H2, M1 and H4 introduced and which previously had no coverage at all.

One wart: every worker-project run prints `[collectCss] Failed to transform 'cloudflare:workers'`. It is Vite's Node-side CSS scan walking a module graph containing workerd-only imports. Harmless, and not suppressible via `server.deps.external` or `css: false` — both were tried and removed rather than left in as dead config.

### M4 — Three client components are testable right now and have no tests · ch13 · **DONE**

`favorite-button.tsx`, `sidebar-item.tsx` and `delete-button.tsx` have no Workers coupling and can be driven through `remix/ui/test`. All three now have tests in the `dom` project; `render()` works unchanged under jsdom.

- **`delete-button.test.browser.tsx`** pins the confirm gate in both directions — declining prevents the submission, confirming leaves it alone for the runtime to drive — plus the `_method` override that lets an HTML form DELETE.
- **`sidebar-item.test.browser.tsx`** pins the active/pending derivation: active from the current URL, falling back to the server's `selected` prop on a URL the matcher does not recognise, pending for the navigation destination, and the search query carried into the href.

`pending-navigation.ts` subscribes to the Navigation API at module scope, which jsdom does not implement, so the sidebar tests mock that one app-owned seam. That is deliberate: the module is trivial, and mocking it is what lets the tests drive the two inputs the component actually derives from.

**Both suites were mutation-checked.** Inverting the confirm gate fails two tests. Two sidebar mutations, however, _survived individually_: dropping the `!isActive &&` guard from `isPending`, and swapping the `isActive ? … : isPending ? …` ternary order. Neither is a test gap — they are equivalent mutants, because the guard and the ternary precedence both independently express "active beats pending". Removing **both** does fail the test that covers the only case where a contact is simultaneously active and the pending destination: navigating from `/contacts/2` to `/contacts/2/edit`.

So the behaviour is pinned, but the component carries a redundant guard. Left as-is — it is the more explicit of the two expressions and removing it would be churn with no observable effect.

### M5 — `UpdateSchema` constrains nothing · ch08 · **DONE**

`first`/`last`/`bsky`/`notes` were defaulted strings with no length or format checks; `avatar` was an arbitrary string. A 10 MB `notes` value or a garbage `bsky` handle was accepted silently. Chapter 8 prescribes `.pipe(...)` checks and `.refine(...)` predicates for exactly this.

**Fixed** in `app/data/schemas.ts`:

| Field           | Constraint                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------- |
| `first`, `last` | `maxLength(100)`                                                                             |
| `notes`         | `maxLength(10_000)`                                                                          |
| `bsky`          | `maxLength(253)` plus a DNS-label handle pattern; `""` and a pasted leading `@` both allowed |
| `avatar`        | must be an `/uploads/<dir>/<file>` path this app generated, or absent                        |

The `avatar` constraint is the one with teeth. It was an arbitrary string rendered straight into `<img src>`, so a hand-crafted submission could point every viewer's browser at someone else's server. Offsite URLs, protocol-relative URLs and traversal attempts are now all rejected.

Two behaviours were checked at the source rather than assumed, because either would have made this a breaking change:

- **Editing without choosing a photo still works.** `uploadHandler` returns `undefined` for an empty file part, and `parseFormData` does `if (value != null) formData.append(…)` (`packages/form-data-parser/src/lib/form-data.ts:294-297`) — the field is omitted entirely rather than stringified, so the refine sees `undefined` and passes.
- **Seeded contacts keep their remote avatars.** Seeds use `https://cdn.bsky.app/…` URLs, but they are written by `db.create` in `db/seed.ts`, never through this schema; and `update` re-assigns `contact.avatar` _after_ parsing when no new file arrives.

The `@`-stripping in `updateContact()` was deliberately left alone. Moving that normalisation into a `.transform()` is reasonable and arguably belongs with the schema, but it is a separate change — the schema simply tolerates the `@` the data layer already strips.

Unlike H1/H2 this **is** covered by tests: `app/data/schemas.ts` imports only `remix/data-schema`, so it is free of the `cloudflare:workers` coupling that M3 describes. `app/data/schemas.test.ts` pins the boundaries — blank submission, omitted avatar, generated upload path, three rejected avatar shapes, `@handle`, non-handles, and the length caps.

### M6 — Double-submit protection is half-built · ch09 · **DONE (by Orion, `8e02198`)**

`favorite-button.tsx` maintained a `submitting` flag for optimistic state but never applied `disabled={submitting}` to the button. The toggle is non-idempotent, so a double-click could land two PATCHes. The flag is now wired to the button.

### Bonus — `IdSchema` numeric checks · **DONE (by Orion, `921bc8f`)**

`IdSchema` coerced to a number but accepted any numeric value. It now refines to a finite, non-negative integer, so `/contacts/-3` and `/contacts/1.5` join `/contacts/abc` in returning the 400 that H2 introduced, rather than reaching the database as a lookup that can never match.

---

## 3. Low / optional

| #   | Item                                                                                             | Chapter | Note                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `resolveFrame` omits `mode: "same-origin"` and the guide's encType-aware `getRequestBody` helper | 06      | Frame `src` values are all internally generated, so low risk; the body helper only matters for URL-encoded submissions                                                                                                                                                                                                                                                                                              |
| L2  | `redirect()` omits `303`                                                                         | 02:237  | Guide says it; **bookstore doesn't do it either**, and browsers treat 302-after-POST identically. Probably ignore                                                                                                                                                                                                                                                                                                   |
| L3  | `sidebar()` lives in `app/actions/`, not `app/ui/`                                               | 02:324  | It returns a `Response`, not JSX — arguably not a "component". Defensible as-is                                                                                                                                                                                                                                                                                                                                     |
| L4  | More dead CSS: `#detail.loading`, `p.loading`                                                    | 04      | No component applies `.loading` to `#detail`                                                                                                                                                                                                                                                                                                                                                                        |
| L5  | Only `sidebar-item.tsx` extends `SerializableProps`                                              | 05      | Harmless inconsistency across the four client entries                                                                                                                                                                                                                                                                                                                                                               |
| L6  | `getContacts()` reads the whole table then sorts in JS                                           | 08      | Leaves the migration's own `contacts_last_createdat_idx` unused by any query. Fine at demo scale; the `matchSorter` fuzzy filter genuinely can't be pushed into SQL                                                                                                                                                                                                                                                 |
| L7  | No CSRF protection on mutating routes                                                            | 10      | Real note, but with no auth and no per-user state there is no ambient authority to abuse — an attacker can just POST directly. Revisit the moment auth lands                                                                                                                                                                                                                                                        |
| L8  | No logging or observability                                                                      | 15      | `logger()` is Node-friendly; Cloudflare gives tail/analytics for free                                                                                                                                                                                                                                                                                                                                               |
| L9  | `deploy` task doesn't chain `db:migrations:deploy`                                               | 14/15   | `dev` chains seeding and local migrations; deploy doesn't, so a schema change can ship ahead of its migration                                                                                                                                                                                                                                                                                                       |
| L10 | No CI workflow at all                                                                            | 14      | No `.github/workflows`; `vp check` and `remix test` run only by hand                                                                                                                                                                                                                                                                                                                                                |
| L11 | `package.json` has no `scripts`                                                                  | 14      | `npm test` / `npm run dev` do nothing; everything is `vp run …`. Deliberate, but surprising to a newcomer                                                                                                                                                                                                                                                                                                           |
| L12 | ~~`remix.json` declares a `*.test.e2e.*` glob with no such files~~                               | 13      | **Moot** — `remix.json` deleted in M3. The `worker` Vitest project drives the real Workers entry, which covers most of what an e2e layer would have                                                                                                                                                                                                                                                                 |
| L13 | No animation anywhere                                                                            | 07      | Chapter is uniformly permissive ("use X when Y wants motion") — never baseline. Pure polish                                                                                                                                                                                                                                                                                                                         |
| L14 | Global 496-line stylesheet instead of `css()` / cascade layers                                   | 04      | Defensible for a demo this size; note it is what let R1 and L4 rot unnoticed                                                                                                                                                                                                                                                                                                                                        |
| L15 | No `fallback` on either `<Frame>`                                                                | 06      | Both regions are essential above-the-fold content, so blocking **matches** the guide. Listed only to record it was checked                                                                                                                                                                                                                                                                                          |
| L16 | `CancelButton` is a JS-only control                                                              | 05      | `<button type="button">` whose only behavior is `navigation.back()`. With JS off, or if its chunk 404s after a deploy, it renders as a live-looking dead button. Every other control in the app works without JS. Fix is a plain `<a href>` to the contact — `create` redirects to `edit`, so the form always has an id — which also deletes a client entry. Changes semantics: destination instead of history-back |

---

## 4. Not applicable

- **`remix/assets`** — asset server, `<ImportMap>`, `processClientEntryPreloads`, multi-import-map polyfill, `app/assets.ts`, asset-entry middleware. Permanently excluded; `@pitlane/dev` resolves client entries to concrete build URLs.
- **`compression()`** — `node:zlib`; Cloudflare compresses at the edge.
- **Node server entry** — `server.ts`, `createRequestListener`, `node-fetch-server`, `hmr.ts` process-restart HMR. This app's Workers entry is correct.
- **Sessions, cookies, auth middleware** (most of ch10) — none exist yet.
- **`remix db` CLI** — D1 migrations go through Wrangler by necessity.
- **Chapter 16** — a markdown rendering showcase; no guidance.
- **`asyncContext()` "Node-only" caveat** — moot, `nodejs_compat` is set.
- **`getContext().get(Database)`** — checked and _correct_; this is the guide-endorsed typed-context pattern, not a divergence.

---

## 5. Bundlerless-pattern audit

Asked: does anything else in this app exist only because upstream has no build step? Two scouts swept `packages/*`, `demos/*` and all 16 chapters.

**Answer: nothing remains.** The whole class was already removed. Full verdicts:

| Pattern                                                                        | Verdict                       | Evidence                                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `<ImportMap>`, `importMapManager`, multi-import-map polyfill                   | no-build only — **never had** | `ui/src/runtime/import-map-manager.ts` (369 lines) merges map fragments shipped per client entry. A Vite bundle has zero import maps |
| `processClientEntryPreloads`                                                   | no-build only — **omitted**   | All 6 demos use it for exactly one thing: `detectMultipleImportMapSupport()` / `preloadShim()`. Nothing else                         |
| `importModule()` in `loadModule`                                               | no-build only — **omitted**   | Demos route through the polyfill; we use plain `import()`, which is all a single-map bundle needs                                    |
| `allowFiles` / `denyFiles` / `allowPackages`, `app/**/public/**`               | no-build only — **removed**   | Confirmed the options are read _only_ inside `packages/assets/src/lib/**`; nothing else gates on them                                |
| `staticFiles()`                                                                | no-build only — **removed**   | ch03:165 — "On a worker, serve static assets through the platform and use the platform's response compression instead"               |
| On-request TS/CSS compile, fingerprinting, source maps, `node_modules` walking | no-build only — **never had** | All inside `packages/assets`; Rollup does it at build time                                                                           |
| `remix/ui-hmr`                                                                 | no-build only — **never had** | Retrofits `import.meta.hot` onto raw-served modules. Vite ships HMR natively                                                         |
| `clientEntry(import.meta.url, …)`                                              | **needed — keep**             | See below                                                                                                                            |
| `loadModule(moduleUrl, exportName)`                                            | **needed — keep**             | Generic IoC hook, required by `run()`, no default                                                                                    |
| `css()` / `createStyleManager`                                                 | **needed — keep**             | Runtime CSSOM machinery, independent of how the module arrived                                                                       |
| `reloadDocument` Navigation-API `traverse` fallback                            | **needed — keep**             | Generic soft-navigation safety net                                                                                                   |

**`import.meta.url` is load-bearing here, for a different reason than upstream.** Upstream passes it so the asset server can map a `file:` URL to a compiled module. Under `@pitlane/dev` it is a _transform marker_: the compiled SSR bundle shows the call rewritten to a manifest lookup, so the renderer never takes its `file:` branch.

```js
clientEntry(mergeAssets(__assets_manifest["client"]["app/actions/contacts/favorite-button.tsx"]).entry + "#FavoriteButton", …)
```

That lands on the canonical `"/js/module.js#ExportName"` form documented at `ui/src/runtime/client-entries.ts:56`. Do not "simplify" the argument away.

**Island load failures are silent by design.** A probe against the real hydration path (hand-built `<!--rmx:h:id-->` markers + `script#rmx-data`, `loadModule` throwing) showed `frame.ts:1323-1325` catches every failure, logs `[createFrame] Failed to load module`, and returns `undefined` — no `error` event, no `ready()` rejection, so the app's banner never fires. That is correct for this app: the server-rendered control stays usable, which is exactly what H4 bought. It is also why L16 matters — `CancelButton` is the one control with nothing to degrade to.

Corollary: the `app.ready().catch(…)` every demo installs is **deliberately omitted**. `run()` already dispatches the error itself (`run.ts:167-170`), and `hydrateInitial()` only rejects on sub-frame / pending-template failures, which this document cannot produce — `render()` fills both frames server-side. Add the catch if a lazily-streamed `<Frame>` is ever introduced.

---

## 6. Progress

| Item                              | Status            |
| --------------------------------- | ----------------- |
| R1 — unstyled error banner        | **done**          |
| R2 — malformed id threw           | **done** (via H2) |
| H1 — no error boundary            | **done**          |
| H2 — `parseSafe` everywhere       | **done**          |
| H5 — dead `staticFiles()`         | **done**          |
| M5 — unconstrained `UpdateSchema` | **done**          |
| M2 — upload limits and MIME trust | **done**          |
| M6 — double-submit protection     | **done** (Orion)  |
| `IdSchema` numeric checks         | **done** (Orion)  |
| H4 — no-JS favorite toggle        | **done**          |
| H3 — SVG stored XSS               | **done** (Orion)  |
| M1 — missing records 404          | **done**          |
| M3 — router-level tests           | **done**          |
| M4 — client component tests       | **done**          |
| L1–L16                            | open (L12 moot)   |

## 7. Suggested order for what's left

1. **L16** — the only remaining item that produces a visibly broken control; the rest are polish or notes.
2. **L1–L15** otherwise; none are load-bearing. L12 is moot.
