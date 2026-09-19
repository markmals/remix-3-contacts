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

### H3 — Uploaded SVGs are a stored-XSS vector · ch11

`image/svg+xml` is in the `ALLOWED_TYPE` allowlist (`app/utils/uploads.ts`), and the `uploads` action streams the file back inline from the app's own origin with the stored, client-declared content type and no `Content-Disposition`.

An SVG containing `<script>` does **not** execute when rendered through the `<img>` tag on the contact page. It _does_ execute if anyone opens `/uploads/avatar/…​.svg` directly — same-origin, so it can reach anything the origin can. Predates this session.

**Fix options:** drop `image/svg+xml` from the allowlist (cheapest, loses nothing for avatars); or serve uploads with `Content-Disposition: attachment` / from a separate origin; or sanitize SVG on upload.

### H4 — The favorite toggle is broken without JavaScript · ch09

`FavoriteButton` is a `clientEntry`, so the server renders a real `RestfulForm`. Submit it with JS disabled (or before hydration) and the `favorite` action returns `Response.json(update)` — the browser navigates to a page of raw JSON and the user loses the app.

Chapter 9's whole framing is HTML-first: _"Build the mutation as an HTML form and controller action first. Once the non-JavaScript request returns the right response, the same form can gain pending state…"_ This is the inverse — the enhanced path works and the baseline doesn't.

**Fix:** branch on the frame headers. Return JSON for the `fetch` path, redirect back to the contact for a native submission.

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

### M1 — Missing records redirect home instead of returning 404 · ch01:297,311-313; ch02:229

`contactPage()` and `update` both `redirect(routes.home.href())` when a contact is absent. Every equivalent branch in `demos/bookstore` returns a 404. A stale bookmark currently yields a `200` after the redirect, which misleads crawlers, link checkers and non-browser clients.

Counter-argument worth weighing: bouncing to the list is arguably nicer UX in a two-pane contacts app. But that argues for a _themed_ 404 rendered into the `detail` frame, not for the wrong status code — the two aren't in tension.

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

### M3 — Router-level tests are structurally impossible today · ch13

Chapter 13's primary server-test boundary is `router.fetch(...)`. That cannot be reached here. Verified:

```
import('./app/utils/uploads.ts')  -> ERR_UNSUPPORTED_ESM_URL_SCHEME  (protocol 'cloudflare:')
```

`app/middleware.ts` and `app/utils/uploads.ts` both bind `cloudflare:workers` `env` at module scope, and `app/entry.server.tsx` builds the router as an eager singleton. `remix test`'s server runner is plain `node:worker_threads`, so the import fails before any test runs. `demos/bookstore` avoids this with a `createBookstoreRouter(options)` factory taking injectable dependencies; this app has no equivalent seam.

**This is the gate on all server-side testing** — worth deciding on before any other test item.

### M4 — Three client components are testable right now and have no tests · ch13

Unlike M3, `favorite-button.tsx`, `sidebar-item.tsx` and `delete-button.tsx` have no Workers coupling and can be driven through `remix/ui/test` today. The favorite button in particular has real logic worth pinning: optimistic toggle, revert on failure, dual-frame reload.

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

| #   | Item                                                                                             | Chapter | Note                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `resolveFrame` omits `mode: "same-origin"` and the guide's encType-aware `getRequestBody` helper | 06      | Frame `src` values are all internally generated, so low risk; the body helper only matters for URL-encoded submissions                                              |
| L2  | `redirect()` omits `303`                                                                         | 02:237  | Guide says it; **bookstore doesn't do it either**, and browsers treat 302-after-POST identically. Probably ignore                                                   |
| L3  | `sidebar()` lives in `app/actions/`, not `app/ui/`                                               | 02:324  | It returns a `Response`, not JSX — arguably not a "component". Defensible as-is                                                                                     |
| L4  | More dead CSS: `#detail.loading`, `p.loading`                                                    | 04      | No component applies `.loading` to `#detail`                                                                                                                        |
| L5  | Only `sidebar-item.tsx` extends `SerializableProps`                                              | 05      | Harmless inconsistency across the four client entries                                                                                                               |
| L6  | `getContacts()` reads the whole table then sorts in JS                                           | 08      | Leaves the migration's own `contacts_last_createdat_idx` unused by any query. Fine at demo scale; the `matchSorter` fuzzy filter genuinely can't be pushed into SQL |
| L7  | No CSRF protection on mutating routes                                                            | 10      | Real note, but with no auth and no per-user state there is no ambient authority to abuse — an attacker can just POST directly. Revisit the moment auth lands        |
| L8  | No logging or observability                                                                      | 15      | `logger()` is Node-friendly; Cloudflare gives tail/analytics for free                                                                                               |
| L9  | `deploy` task doesn't chain `db:migrations:deploy`                                               | 14/15   | `dev` chains seeding and local migrations; deploy doesn't, so a schema change can ship ahead of its migration                                                       |
| L10 | No CI workflow at all                                                                            | 14      | No `.github/workflows`; `vp check` and `remix test` run only by hand                                                                                                |
| L11 | `package.json` has no `scripts`                                                                  | 14      | `npm test` / `npm run dev` do nothing; everything is `vp run …`. Deliberate, but surprising to a newcomer                                                           |
| L12 | `remix.json` declares a `*.test.e2e.*` glob with no such files                                   | 13      | Frame-heavy flows are a good e2e fit; `demos/frame-navigation` has `app.test.e2e.ts`                                                                                |
| L13 | No animation anywhere                                                                            | 07      | Chapter is uniformly permissive ("use X when Y wants motion") — never baseline. Pure polish                                                                         |
| L14 | Global 496-line stylesheet instead of `css()` / cascade layers                                   | 04      | Defensible for a demo this size; note it is what let R1 and L4 rot unnoticed                                                                                        |
| L15 | No `fallback` on either `<Frame>`                                                                | 06      | Both regions are essential above-the-fold content, so blocking **matches** the guide. Listed only to record it was checked                                          |

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

## 5. Progress

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
| H3, H4, M1, M3, M4, L1–L15        | open              |

## 6. Suggested order for what's left

1. **H3** — smallest real security win available (drop one MIME type).
2. **H4, M1** — both are "return the right response for the unenhanced request"; natural pair.
3. **M3** decides whether server testing is on the table at all. Answer it before M4 or L12 — and it is what currently blocks regression tests for H1 and H2.
