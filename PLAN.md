# Declarative Frame Router - Type-Safe Tuple API

## Vision

Create a **fully type-safe, zero-config frame router** using route objects and tuple syntax. The API should:

- ✅ Use existing route objects (no pattern duplication)
- ✅ Infer all types automatically (no explicit typing)
- ✅ Generate nested resolver/reload APIs from config structure
- ✅ Support deeply nested frame names
- ✅ Derive `match`, `canIntercept`, `reload` from configuration

**API Goals:**

```ts
const frames = createRouter({
  sidebar: [
    [routes.home, ({}, url) => routes.frame.sidebar.href(...)],
    [routes.contacts.show, ({ id }, url) => routes.frame.sidebar.href(...)],
  ],
  detail: [
    [routes.home, () => routes.frame.zero.href()],
    [routes.contacts.show, ({ id }) => routes.frame.show.href({ id })],
  ],
});

// Auto-generated API:
frames.resolve.sidebar(url)           // → string
frames.resolve.detail(url)            // → string
frames.reload.sidebar(url, handle)    // → Promise<void>
frames.reloadAll(url, handle)         // → Promise<void>
frames.match(url)                     // → { params: ... } | null
frames.canIntercept(url)              // → boolean
```

---

## Current Problems

### 1. Pattern Duplication

```ts
// routes.ts
contacts: {
    show: {
        pattern: "/contacts/:id";
    }
}

// matcher.ts
this.#contact.add(routes.contacts.show.pattern, "show"); // repeat pattern

// frame-utils.ts
const match = Matcher.shared.match(url); // manually match again
```

### 2. Manual Type Annotations

```ts
// Must manually type params
function resolver(id: string, url: URL): string {
    return routes.frame.show.href({ id });
}
```

### 3. Scattered Configuration

- Route patterns in `routes.ts`
- Frame logic in `frame-utils.ts`
- Matching in `matcher.ts`
- Navigation in `NavigationEnhancer.tsx`

---

## Proposed API Design

### Configuration Structure

```ts
import { createRouter } from "~/lib/frame-router.ts";
import { routes } from "~/routes.ts";

export const frames = createRouter({
    // Frame name: Array of [route, resolver] tuples
    sidebar: [
        [
            routes.home,
            ({}, url) => routes.frame.sidebar.href(null, { q: url.searchParams.get("q") }),
        ],
        [
            routes.contacts.show,
            ({ id }, url) =>
                routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ],
        [
            routes.contacts.edit,
            ({ id }, url) =>
                routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ],
    ],

    detail: [
        [routes.home, () => routes.frame.zero.href()],
        [routes.contacts.show, ({ id }) => routes.frame.show.href({ id })],
        [routes.contacts.edit, ({ id }) => routes.frame.edit.href({ id })],
    ],

    // Nested frame names supported
    nested: {
        deep: {
            below: [
                [routes.home, () => routes.frame.zero.href()],
                [routes.contacts.show, ({ id }) => routes.frame.show.href({ id })],
            ],
        },
    },
});
```

### Generated API

```ts
// Resolve individual frame sources
const src = frames.resolve.sidebar(url); // string
const src2 = frames.resolve.detail(url); // string
const src3 = frames.resolve.nested.deep.below(url); // string

// Reload individual frames
await frames.reload.sidebar(url, handle);
await frames.reload.detail(url, handle);
await frames.reload.nested.deep.below(url, handle);

// Reload all frames
await frames.reloadAll(url, handle);

// Match current URL against all configured routes
const match = frames.match(url);
// Type: { params: { id: string | null } } | { params: null }

// Match all routes (returns array)
const matches = frames.matchAll(url);
// Type: Array<{ params: { id: string | null } } | { params: null }>

// Check if URL should intercept navigation
if (frames.canIntercept(url)) {
    // ...
}
```

---

## Type System Design

### Key Type Challenges

1. **Extract params from route objects**
    - Routes have patterns like `"/contacts/:id"`
    - Need to infer `{ id: string }` from the route object

2. **Union types from multiple routes**
    - Frame has routes: `[routes.home, routes.contacts.show]`
    - Result: `{} | { id: string }`

3. **Nested object API generation**
    - Config: `{ nested: { deep: { below: [...] } } }`
    - API: `frames.resolve.nested.deep.below(url)`

4. **Type-safe resolver functions**
    - Resolver receives params matching route pattern
    - ts should error if resolver expects wrong params

### Type Implementation Strategy

```ts
// Extract route params from route object
type RouteParams<R> = R extends { params: infer P } ? P : never;

// Extract params from tuple
type TupleParams<T> = T extends [infer Route, (params: infer P, url: URL) => string] ? P : never;

// Union all params from tuple array
type UnionParams<Tuples extends ReadonlyArray<any>> =
    Tuples extends ReadonlyArray<[any, (params: infer P, url: URL) => string]> ? P : never;

// Generate nested resolve/reload API
type NestedAPI<Config> = {
    [K in keyof Config]: Config[K] extends ReadonlyArray<any>
        ? (url: URL | string) => string
        : NestedAPI<Config[K]>;
};
```

---

## Implementation Plan

### Phase 1: Core Type System

**File: `/src/lib/frame-router/types.ts`**

```ts
import type { Handle } from "remix/component";

/**
 * Route resolver function signature
 * Takes extracted params and URL, returns frame source URL
 */
export type RouteResolver<Params = any> = (params: Params, url: URL) => string;

/**
 * Route tuple: [route object, resolver function]
 */
export type RouteTuple<R = any, P = any> = readonly [R, RouteResolver<P>];

/**
 * Frame configuration - nested object or array of route tuples
 */
export type FrameConfig = ReadonlyArray<RouteTuple> | { [key: string]: FrameConfig };

/**
 * Extract param type from resolver function
 */
export type ExtractParams<R> = R extends RouteResolver<infer P> ? P : never;

/**
 * Union all params from array of tuples
 */
export type UnionTupleParams<Tuples extends ReadonlyArray<RouteTuple>> =
    Tuples[number] extends RouteTuple<any, infer P> ? P : never;

/**
 * Generate nested resolve API from config
 */
export type ResolveAPI<Config> = {
    [K in keyof Config]: Config[K] extends ReadonlyArray<RouteTuple>
        ? (url: URL | string) => string
        : Config[K] extends object
          ? ResolveAPI<Config[K]>
          : never;
};

/**
 * Generate nested reload API from config
 */
export type ReloadAPI<Config> = {
    [K in keyof Config]: Config[K] extends ReadonlyArray<RouteTuple>
        ? (url: URL | string, handle: Handle) => Promise<void>
        : Config[K] extends object
          ? ReloadAPI<Config[K]>
          : never;
};

/**
 * Frame router instance with generated API
 */
export interface FrameRouter<Config extends FrameConfig> {
    /**
     * Nested resolve API - matches config structure
     */
    resolve: ResolveAPI<Config>;

    /**
     * Nested reload API - matches config structure
     */
    reload: ReloadAPI<Config>;

    /**
     * Reload all frames at once
     */
    reloadAll(url: URL | string, handle: Handle): Promise<void>;

    /**
     * Match URL and return first matching params
     */
    match(url: URL | string): { params: any } | null;

    /**
     * Match URL and return all matching params
     */
    matchAll(url: URL | string): Array<{ params: any }>;

    /**
     * Check if URL matches any configured route
     */
    canIntercept(url: URL | string): boolean;
}
```

### Phase 2: Runtime Implementation

**File: `/src/lib/frame-router/core.ts`**

```ts
import { ArrayMatcher, type Match } from "remix/route-pattern";
import type { Handle } from "remix/component";
import type { FrameConfig, RouteTuple, FrameRouter, RouteResolver } from "./types";

/**
 * Create a frame router from configuration
 */
export function createRouter<Config extends FrameConfig>(config: Config): FrameRouter<Config> {
    // Collect all route tuples from nested config
    const allTuples: Array<{ framePath: string[]; tuple: RouteTuple }> = [];

    function collect(obj: any, path: string[] = []) {
        if (Array.isArray(obj)) {
            // This is a tuple array - store with frame path
            for (const tuple of obj) {
                allTuples.push({ framePath: path, tuple });
            }
        } else if (typeof obj === "object" && obj !== null) {
            // Recurse into nested object
            for (const [key, value] of Object.entries(obj)) {
                collect(value, [...path, key]);
            }
        }
    }

    collect(config);

    // Build matcher for all routes
    const matcher = new ArrayMatcher<{
        framePath: string[];
        resolver: RouteResolver;
    }>();

    for (const { framePath, tuple } of allTuples) {
        const [route, resolver] = tuple;

        // Route object must have a pattern property
        if (!route?.pattern) {
            throw new Error(
                `Route object must have a 'pattern' property: ${JSON.stringify(route)}`,
            );
        }

        matcher.add(route.pattern, { framePath, resolver });
    }

    // Generate nested resolve API
    const resolve = generateNestedAPI(config, (framePath: string[]) => (url: URL | string) => {
        const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
        const match = matcher.match(urlObj);

        if (!match || !pathEquals(match.data.framePath, framePath)) {
            return null;
        }

        return match.data.resolver(match.params, urlObj);
    });

    // Generate nested reload API
    const reload = generateNestedAPI(
        config,
        (framePath: string[]) => async (url: URL | string, handle: Handle) => {
            const src = resolve[framePath[0]];
            for (let i = 1; i < framePath.length; i++) {
                src = src[framePath[i]];
            }

            const frameSource = typeof src === "function" ? src(url) : null;
            if (!frameSource) return;

            const frameName = framePath.join(".");
            const frame = handle.frames.get(frameName);
            if (!frame) return;

            frame.src = frameSource;
            await frame.reload();
        },
    );

    return {
        resolve: resolve as any,
        reload: reload as any,

        async reloadAll(url: URL | string, handle: Handle) {
            const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;

            // Get all matching routes
            const matches = matcher.matchAll(urlObj);

            // Group by frame path to avoid duplicate reloads
            const frameMap = new Map<string, string>();

            for (const match of matches) {
                const { framePath, resolver } = match.data;
                const frameName = framePath.join(".");
                const src = resolver(match.params, urlObj);
                frameMap.set(frameName, src);
            }

            // Reload all frames
            await Promise.all(
                Array.from(frameMap.entries()).map(async ([frameName, src]) => {
                    const frame = handle.frames.get(frameName);
                    if (!frame) return;

                    frame.src = src;
                    await frame.reload();
                }),
            );
        },

        match(url: URL | string) {
            const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
            const match = matcher.match(urlObj);
            return match ? { params: match.params } : null;
        },

        matchAll(url: URL | string) {
            const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
            const matches = matcher.matchAll(urlObj);
            return matches.map(m => ({ params: m.params }));
        },

        canIntercept(url: URL | string) {
            const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
            return matcher.match(urlObj) !== null;
        },
    };
}

/**
 * Generate nested API object from config structure
 */
function generateNestedAPI(
    config: any,
    createLeaf: (framePath: string[]) => any,
    path: string[] = [],
): any {
    if (Array.isArray(config)) {
        // Leaf node - create resolver/reload function
        return createLeaf(path);
    }

    // Branch node - recurse
    const result: any = {};
    for (const [key, value] of Object.entries(config)) {
        result[key] = generateNestedAPI(value, createLeaf, [...path, key]);
    }
    return result;
}

/**
 * Check if two paths are equal
 */
function pathEquals(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
```

### Phase 3: Route Configuration

**File: `/src/frames.ts`** (NEW)

```ts
import { createRouter } from "~/lib/frame-router/core";
import { routes } from "~/routes";

export const frames = createRouter({
    sidebar: [
        [
            routes.home,
            ({}, url) => routes.frame.sidebar.href(null, { q: url.searchParams.get("q") }),
        ],
        [
            routes.contacts.show,
            ({ id }, url) =>
                routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ],
        [
            routes.contacts.edit,
            ({ id }, url) =>
                routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ],
    ],

    detail: [
        [routes.home, () => routes.frame.zero.href()],
        [routes.contacts.show, ({ id }) => routes.frame.show.href({ id })],
        [routes.contacts.edit, ({ id }) => routes.frame.edit.href({ id })],
    ],
} as const);

// Type tests (should all pass)
frames.resolve.sidebar satisfies (url: URL | string) => string;
frames.resolve.detail satisfies (url: URL | string) => string;
frames.reload.sidebar satisfies (url: URL | string, handle: any) => Promise<void>;
frames.reloadAll satisfies (url: URL | string, handle: any) => Promise<void>;
frames.match satisfies (url: URL | string) => { params: any } | null;
frames.canIntercept satisfies (url: URL | string) => boolean;
```

### Phase 4: Update Components

**File: `/src/components/Document.tsx`** (UPDATED)

```tsx
import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import { NavigationEnhancer } from "~/assets/NavigationEnhancer.tsx";
import { SearchBar } from "~/assets/SearchBar.tsx";
import { frames } from "~/frames.ts";
import { routes } from "~/routes.ts";

export function Document() {
    const { url } = getContext();

    // Use frame router to resolve sources
    const sidebarSrc = frames.resolve.sidebar(url);
    const detailSrc = frames.resolve.detail(url);

    return () => (
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Remix Contacts</title>
                <link rel="stylesheet" href="/assets/index.css" />
            </head>
            <body>
                <div id="root">
                    <div id="sidebar">
                        <h1>Remix 3 Contacts</h1>
                        <div>
                            <SearchBar setup={{ query: url.searchParams.get("q") }} />
                            <form action={routes.contacts.create.href()} method="POST">
                                <button type="submit">New</button>
                            </form>
                        </div>
                        {sidebarSrc && <Frame name="sidebar" src={sidebarSrc} />}
                    </div>
                    {detailSrc && <Frame name="detail" src={detailSrc} />}
                </div>
                <NavigationEnhancer />
            </body>
        </html>
    );
}
```

**File: `/src/assets/NavigationEnhancer.tsx`** (UPDATED)

```ts
import { clientEntry, type Handle } from "remix/component";
import { frames } from "~/frames.ts";

export const NavigationEnhancer = clientEntry(
    "/assets/NavigationEnhancer.js#NavigationEnhancer",
    function NavigationEnhancer(handle: Handle) {
        if (typeof window !== "undefined") {
            handle.on(navigation, {
                navigate(event) {
                    if (event.hashChange || !event.canIntercept) return;

                    const url = new URL(event.destination.url);
                    const isFormSubmission = event.formData !== null;

                    if (url.origin !== location.origin) return;

                    // Use frame router to check interception
                    if (!isFormSubmission && !frames.canIntercept(url)) return;

                    event.intercept({
                        focusReset: "manual",
                        async precommitHandler() {
                            if (isFormSubmission) {
                                const response = await fetch(url, {
                                    method: "POST",
                                    body: event.formData,
                                    signal: event.signal,
                                });
                                navigation.navigate(response.url);
                                return;
                            }

                            // Reload all frames
                            await frames.reloadAll(url, handle);
                        },
                    });
                },
            });
        }

        return () => null;
    },
);
```

**File: `/src/assets/SidebarItem.tsx`** (UPDATED)

```tsx
import { clientEntry, type Handle } from "remix/component";
import type { Contact } from "~/lib/database/schema.ts";
import { frames } from "~/frames.ts";

export const SidebarItem = clientEntry(
    "/assets/SidebarItem.js#SidebarItem",
    function SidebarItem(handle: Handle) {
        let destinationUrl: string | null = null;

        handle.on(navigation, {
            navigate(event) {
                destinationUrl = event.destination.url;
                handle.update();
            },
            currententrychange() {
                destinationUrl = null;
                handle.update();
            },
        });

        return ({ selected, query, contact }: SidebarItem.Props) => {
            // Use frame router to match destination
            const destination = frames.match(destinationUrl);
            const isPending = Number(destination?.params.id) === contact.id;
            const isActive = Number(selected) === contact.id;

            return (
                <li>
                    <a
                        href={
                            contact.favorite
                                ? `/contacts/${contact.id}?q=${query || ""}`
                                : `/contacts/${contact.id}`
                        }
                        class={isActive ? "active" : isPending ? "pending" : undefined}
                    >
                        {contact.first} {contact.last}
                    </a>
                </li>
            );
        };
    },
);

export namespace SidebarItem {
    export interface Props {
        selected: string | null;
        query: string | null;
        contact: Contact;
    }
}
```

### Phase 5: Remove Old Files

```bash
rm src/lib/matcher.ts
rm src/lib/frame-utils.ts
```

---

## Advanced Features

### 1. Nested Frame Names

Already supported! Config structure defines frame names:

```ts
export const frames = createRouter({
    layout: {
        header: [[routes.home, () => "/_frame/header"]],
        footer: [[routes.home, () => "/_frame/footer"]],
    },
});

// Usage:
frames.resolve.layout.header(url);
frames.reload.layout.header(url, handle);
```

### 2. Fallback Routes

Add a catch-all at the end:

```ts
detail: [
  [routes.contacts.show, ({ id }) => routes.frame.show.href({ id })],
  [routes.contacts.edit, ({ id }) => routes.frame.edit.href({ id })],

  // Fallback for any other route
  [new RoutePattern("*"), () => routes.frame.zero.href()],
],
```

### 3. Conditional Frame Loading

Use null to skip frames:

```ts
comments: [
  [routes.posts.show, ({ id }, url) => {
    // Only load comments if query param present
    return url.searchParams.has("showComments")
      ? routes.frame.comments.href({ postId: id })
      : null;
  }],
],
```

### 4. Shared Resolvers

Extract common resolver logic:

```ts
const sidebarResolver = (params: { id?: string }, url: URL) =>
    routes.frame.sidebar.href(null, {
        selected: params.id,
        q: url.searchParams.get("q"),
    });

export const frames = createRouter({
    sidebar: [
        [routes.home, sidebarResolver],
        [routes.contacts.show, sidebarResolver],
        [routes.contacts.edit, sidebarResolver],
    ],
});
```

---

## Type Safety Examples

### Example 1: Correct Types

```ts
// ✅ Correct - params match route
[routes.contacts.show, ({ id }, url) => routes.frame.show.href({ id })][
    // ✅ Correct - empty params for home route
    (routes.home, ({}, url) => routes.frame.sidebar.href())
];
```

### Example 2: Type Errors

```ts
// ❌ Error - id is required for contacts.show route
[routes.contacts.show, ({}, url) => routes.frame.show.href()][
    // ❌ Error - home route doesn't have id param
    (routes.home, ({ id }, url) => routes.frame.show.href({ id }))
][
    // ❌ Error - wrong param name
    (routes.contacts.show, ({ contactId }, url) => routes.frame.show.href({ contactId }))
];
```

### Example 3: Union Types

```ts
const match = frames.match("/contacts/123");

// Type is: { params: {} } | { params: { id: string } }

if (match && "id" in match.params) {
    // ts knows id exists here
    const id: string = match.params.id;
}
```

---

## Benefits

| Aspect                  | Before                 | After                     |
| ----------------------- | ---------------------- | ------------------------- |
| **Configuration**       | 4 files                | 1 file (`frames.ts`)      |
| **Pattern Duplication** | Yes (routes + matcher) | No (use route objects)    |
| **Type Safety**         | Partial                | Full (params inferred)    |
| **Nested Frames**       | Manual                 | Automatic from config     |
| **API Generation**      | Manual methods         | Auto-generated nested API |
| **Discoverability**     | Scattered              | All in one config         |

---

## Migration Steps

### Step 1: Create Frame Router

```bash
mkdir -p src/lib/frame-router
touch src/lib/frame-router/types.ts
touch src/lib/frame-router/core.ts
```

Copy implementation from above.

### Step 2: Create Frame Configuration

```bash
touch src/frames.ts
```

Convert current frame logic to tuple syntax.

### Step 3: Update Components

1. `Document.tsx` - Use `frames.resolve.*(url)`
2. `NavigationEnhancer.tsx` - Use `frames.canIntercept()` and `frames.reloadAll()`
3. `SidebarItem.tsx` - Use `frames.match()`

### Step 4: Test

- Verify all routes work
- Check type inference
- Test nested frame names (if any)
- Validate param extraction

### Step 5: Clean Up

```bash
rm src/lib/matcher.ts
rm src/lib/frame-utils.ts
```

---

## Open Questions

1. **Should `resolve.*` return `null` or throw for no match?**
    - Current: returns `null`
    - Alternative: throw error for no match
    - Trade-off: null is safer, throw is more explicit

2. **How to handle route param types from route objects?**
    - Need to extract param types from route definition
    - May require route objects to carry type information
    - Could use branded types or phantom types

3. **Should we support route priorities?**
    - First match wins (current)
    - Most specific wins (could add)
    - Manual priority numbers

4. **Performance optimization for large configs?**
    - Build matchers once at initialization
    - Cache resolved frame sources
    - Memoize match results

---

## Success Criteria

✅ Zero string pattern duplication (use route objects)
✅ Full type inference (no explicit annotations needed)
✅ Nested frame API auto-generated from config
✅ Single configuration file for all frame logic
✅ Type-safe params in resolver functions
✅ Supports deeply nested frame names
✅ Can be extracted as reusable library

---

## Next Steps

1. Implement core type system and runtime
2. Create frame configuration for contacts app
3. Update components to use new API
4. Test thoroughly with type checking
5. Remove old files
6. Document patterns for future use
