# Frame Router API Restructure

Restructure the frame router so frame-level operations (`resolve`, `reload`, `name`) live on frame nodes instead of at the root, and router-wide utilities live under a `$` property.

## Current API

```ts
frames.resolve.sidebar(url);
frames.reload.sidebar(url, handle);
frames.reloadAll(url, handle);
frames.match(url);
frames.matchAll(url);
frames.canIntercept(url);
```

## New API

### Frame nodes

Each config key that maps to a `RouteTuple[]` becomes a `FrameNode`:

```ts
frames.sidebar.resolve(url); // resolve frame source URL
frames.sidebar.reload(url, handle); // reload the frame
frames.sidebar.name; // "sidebar"

// Nested example:
frames.foo.bar.resolve(url);
frames.foo.bar.name; // "foo-bar"
```

```ts
interface FrameNode {
    resolve(url: URL | string): string | null;
    reload(url: URL | string, handle: Handle): Promise<void>;
    name: string;
}
```

### Utility object (`$`)

Router-wide operations move to `frames.$`:

```ts
frames.$.reloadAll(url, handle);
frames.$.match(url);
frames.$.matchAll(url);
frames.$.canIntercept(url);
```

```ts
interface FrameUtils {
    reloadAll(url: URL | string, handle: Handle): Promise<void>;
    match(
        url: URL | string | null | undefined,
    ): { params: Record<string, string | undefined> } | null;
    matchAll(
        url: URL | string | null | undefined,
    ): Array<{ params: Record<string, string | undefined> }>;
    canIntercept(url: URL | string): boolean;
}
```

## Files changed

### `src/lib/frame-router/types.ts`

- Remove `ResolveAPI`, `ReloadAPI`, and unused types (`ExtractParams`, `UnionTupleParams`, `UnionAllParams`, `MergedParams`, `UnionToIntersection`, `StripIndexSignature`).
- Add `FrameNode` interface.
- Add `FrameUtils` interface.
- Add `FrameNodeAPI<Config>` mapped type:
    ```ts
    type FrameNodeAPI<Config> = {
        [K in keyof Config]: Config[K] extends readonly any[]
            ? FrameNode
            : Config[K] extends object
              ? FrameNodeAPI<Config[K]>
              : never;
    };
    ```
- Replace `FrameRouter<Config>` with `FrameNodeAPI<Config> & { $: FrameUtils }`.

### `src/lib/frame-router/core.ts`

- Replace `generateNestedAPI` (called twice for resolve/reload) with a single `generateFrameNodes` that builds objects with `{ resolve, reload, name }` for each leaf. Each leaf node has direct access to both resolve and reload logic, eliminating the current coupling where `reload` navigates through the `resolve` object.
- Change frame name joiner from `"."` to `"-"` (affects `reload` and `reloadAll`).
- Attach `$` property with `reloadAll`, `match`, `matchAll`, `canIntercept`.
- Remove separate `resolve` and `reload` top-level properties from the return value.

### `src/components/Document.tsx`

- `frames.resolve.sidebar(url)` → `frames.sidebar.resolve(url)`
- `frames.resolve.detail(url)` → `frames.detail.resolve(url)`
- `<Frame name="sidebar" ...>` → `<Frame name={frames.sidebar.name} ...>`
- `<Frame name="detail" ...>` → `<Frame name={frames.detail.name} ...>`

### `src/assets/Navigator.tsx`

- `frames.reload.detail(url, handle)` → `frames.detail.reload(url, handle)`
- `frames.reload.sidebar(url, handle)` → `frames.sidebar.reload(url, handle)`
- `frames.canIntercept` → `frames.$.canIntercept`

### `src/assets/SidebarItem.tsx`

- `frames.match(navigating.to.url)` → `frames.$.match(navigating.to.url)`

### `src/frames.ts`

No changes. The config format passed to `createFrames` is unchanged.

## Design decisions

- **`$` as plain property, not a Symbol**: `$` is a valid JS identifier so `frames.$.reloadAll()` works without imports. Collision with a user-defined frame name `$` is theoretically possible but practically impossible.
- **`name` uses hyphens**: `foo-bar` rather than `foo.bar` or `foo/bar`. Hyphens are safe in HTML attributes and match the convention for `<Frame name="...">`. The current code uses dots (`framePath.join(".")`); this changes to hyphens. For single-segment names like `sidebar` and `detail` this is invisible, but nested names will use hyphens going forward.
- **No changes to `createFrames` input**: The restructure is purely an output shape change.
