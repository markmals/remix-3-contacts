# Remix 3 Contacts CRUD (SSR + Hydration + Frames + fetch-router)

## Summary

Build a contacts app in this repo using Remix 3’s component runtime, server rendering, hydration, and frame primitives, with `remix/fetch-router` as the only router.

The app will keep canonical URLs (`/`, `/contacts/:contactId`, `/contacts/:contactId/edit`) while using named `<Frame>` regions and hydrated client entries to deliver client-router-like transitions without adding a client-side router package.

## Decisions Locked

- Navigation model: frame-scoped navigation (no dedicated client router).
- Search UX: live-on-input search.
- Mutation HTTP style: hybrid.
    - Update uses REST semantics via `_method=PUT` + middleware.
    - Destroy stays explicit via `/contacts/:contactId/destroy`.
- New contact flow: create, then navigate to `/contacts/:contactId/edit`.
- Missing contact: redirect to `/`.
- Constraint: only currently installed packages; no new dependencies.

## Important API / Interface Changes

- `src/routes.ts`
    - Keep existing route expectations and extend with missing typed entries needed for actions
    - Utilize internal frame routes for explicit frame content endpoints.
- `src/router.tsx`
    - Initialize `createRouter` with middleware:
        - `staticFiles("./public")`
        - `formData()`
        - `methodOverride()`
    - Map controller actions for:
        - document routes (full HTML shell)
        - frame routes (partial HTML for named frames)
        - mutation routes (create/update/favorite/destroy).
- Client-side public contract (internal app API):
    - data attributes for progressive enhancement hooks (e.g. target frame + canonical URL behavior) used by hydrated navigation/search client entries.

## Implementation Plan

1. **Define Route Surface**

- Normalize `src/routes.ts` into a decision-complete map for:
    - Canonical document paths.
    - Mutation endpoints.
    - Internal frame endpoints.
- Ensure all links/forms use `routes.*.href(...)` (no hardcoded paths).

2. **Create HTML Composition Layer**

- Add server-rendered component modules for:
    - `DocumentShell` (`<html>`, `<head>`, stylesheet, hydration script).
    - `SidebarFrameContent`.
    - `DetailZeroState`, `DetailShow`, `DetailEdit`.
- Keep `src/index.css` as the visual baseline; only add selectors if strictly required for frame attributes/states.

3. **Wire SSR + Frame Resolution**

- In route handlers for document responses:
    - call `renderToStream(<DocumentShell ... />, { resolveFrame })`.
- `resolveFrame(src)` will resolve via `router.fetch()` to internal frame endpoints so frames can stream server-side consistently.
- Return with `createHtmlResponse(stream)`.

4. **Hydration Bootstrap**

- Add `src/assets/entry.tsx` that calls `run(document, { loadModule, resolveFrame })`.
- Client `resolveFrame` fetches HTML for frame reloads.
- Ensure the module output path matches existing `esbuild` script (`public/assets/...`).

5. **Hydrated Client Entries (minimal set)**

- `NavigationEnhancer` client entry:
    - intercept in-app link clicks and form submissions tagged for frame navigation,
    - update target named frame(s),
    - URL updates happen by initiating a navigation (`window.navigation.navigate()`/`window.navigation.reload()`) and/or by setting `history: "push" | "replace"` for that navigation.
    - Back/forward handling is `window.navigation.addEventListener("navigate", ...)` (and optionally `window.navigation.addEventListener("navigatesuccess", ...)`/`window.navigation.addEventListener("navigateerror", ...)`), not `popstate`.
        - We want to reload the relevant frame(s) after this notification.
        - You get an explicit `NavigationEvent` with `destination`, `hashChange`, `canIntercept`, and `intercept()` to run your frame reload logic.
        - Standard `<a>` links and `<form>` submissions should be intercepted by the `"navigate"` event so there is no need to create custom components for those, just to handle navigation/frame reloading.
- `LiveSearch` client entry:
    - submit GET on input,
    - remove empty `q`,
    - replace history after first search (match expected behavior).
- `Favorite` client entry:
    - optimistic toggle UI,
    - submit mutation,
    - reload detail + sidebar frames after completion.
- `DeleteConfirm` client entry:
    - confirm delete,
    - submit delete form,
    - navigate to `/` and refresh frames.

6. **Server Actions and Data Flow**

- Use existing `src/lib/contacts.ts` for DB operations.
- Route behaviors:
    - `POST /contacts`: create blank contact, redirect to `/contacts/:id/edit`.
    - `PUT /contacts/:id`: update from `FormData`, redirect `/contacts/:id`.
    - `POST /contacts/:id/destroy`: delete, redirect `/`.
    - favorite toggle: `PUT /contacts/:id` with favorite field (or dedicated action endpoint if cleaner while keeping hybrid rule).
- Apply URL search param `q` for sidebar contact filtering on both document and frame responses.

7. **Error Handling**

- Missing contact in show/edit/action handlers: redirect `/` (per decision).
- Preserve global 500 handling already in `server.ts`.
- Maintain proper status codes on redirects and frame responses where applicable.

8. **Verification**

- Add/adjust node-based tests (router-level, no dev server required) covering:
    - document routes return HTML with frame placeholders.
    - frame endpoints return fragment HTML.
    - create redirects to edit URL.
    - update via `_method=PUT` works.
    - destroy endpoint deletes and redirects `/`.
    - search `q` filters sidebar output.
    - missing contact redirects `/`.
    - frame endpoints return partial HTML compatible with `Frame` replacement + hydration.
- Run:
    - `pnpm run typecheck`
    - `pnpm run fmt`
    - `pnpm run lint`

## Test Cases and Scenarios

1. `GET /` returns full HTML, includes sidebar and detail frame mounts, includes hydration entry script.
2. `GET /contacts/:id` returns full HTML with detail frame targeting that contact.
3. `GET /contacts/:id/edit` returns full HTML edit state.
4. `POST /contacts` creates and redirects to `/contacts/:id/edit`.
5. `POST /contacts/:id` with `_method=PUT` updates and redirects `/contacts/:id`.
6. `POST /contacts/:id/destroy` deletes and redirects `/`.
7. `GET` with `q=kent` filters sidebar list.
8. Missing contact routes redirect to `/`.
9. Frame endpoints return partial HTML compatible with `Frame` replacement + hydration.

## Assumptions and Defaults

- `../react-router-ssr-contacts` is a macOS alias to another directory, so you'll need to resolve it's location using `./resolve-alias.sh ../react-router-ssr-contacts` before reading its contents. Behavior parity should be based on this contacts example, plus existing CSS/route scaffold here.
- Existing CSS and DB modules are baseline and should be reused, not reworked.
- No dedicated client-side router library will be introduced.
- No new dependencies will be added.
