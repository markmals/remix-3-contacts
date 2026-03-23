# Update Remix Docs & APIs

**Date**: 2026-03-22
**Scope**: Conservative — update existing imports/APIs to latest versions, adopt only APIs that directly improve existing code.

## Context

This project is a Remix 3 contacts demo app using `remix` from `github:remix-run/remix#preview/main&path:packages/remix`. The upstream repo has grown from the packages we use to 38 total packages. Documentation in `docs/` is stale and needs replacement with current upstream content.

## Step 1: Documentation Replacement

Delete all 21 files currently in `docs/`.

### Component docs (15 files from `packages/component/docs/`)

Fetch via `gh api` and write to `docs/`:
- `components.md`, `composition.md`, `context.md`, `events.md`, `frames.md`
- `getting-started.md`, `handle.md`, `hydration.md`, `interactions.md`, `patterns.md`
- `server-rendering.md`, `spring.md`, `styling.md`, `testing.md`, `tween.md`

### Package READMEs (12 files from individual `packages/<name>/README.md`)

Fetch via `gh api` and write to `docs/<package-name>.md`:
- `async-context-middleware.md`
- `fetch-router.md`
- `form-data-middleware.md`
- `method-override-middleware.md`
- `static-middleware.md`
- `response.md`
- `interaction.md`
- `route-pattern.md`
- `data-table.md`
- `data-table-sqlite.md`
- `data-schema.md`
- `node-fetch-server.md`

**Removed** (no longer upstream): `animate.md`, `interaction-package.md`
**New**: `testing.md`, plus several package READMEs that weren't previously tracked locally.

**Total**: 27 doc files replacing the current 21.

## Step 2: Package Update

1. Run `pnpm update` to fetch latest `preview/main` packages
2. Run `pnpm run typecheck` to establish a baseline of any immediate breakage

## Step 3: API Change Analysis & Code Updates

1. Use `git diff` on the replaced docs to identify:
   - Changed function signatures or renamed exports
   - New required parameters or removed APIs
   - Deprecated patterns replaced by new ones

2. Update code conservatively:
   - Fix any breaking changes (type errors, renamed APIs)
   - Adopt updated patterns where current code uses a now-deprecated approach
   - No new features, no new packages, no architectural changes

3. Verify with `pnpm run typecheck`, `pnpm run lint`, and `pnpm run fmt`

## Packages Used by This Repo

From `remix/`:
1. `component` (core + `/jsx-runtime`, `/server`)
2. `fetch-router` (+ `/routes`)
3. `async-context-middleware`
4. `form-data-middleware`
5. `method-override-middleware`
6. `static-middleware`
7. `response` (`/redirect`, `/html`)
8. `interaction`
9. `route-pattern`
10. `data-table`
11. `data-table-sqlite`
12. `data-schema` (`/checks`)
13. `node-fetch-server`
