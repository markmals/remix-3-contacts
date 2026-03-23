/** biome-ignore-all lint/suspicious/noExplicitAny: necessary for type inference */

import type { Handle } from "remix/component";
import type { Route } from "remix/fetch-router/routes";
import { TrieMatcher } from "remix/route-pattern";
import type { ExtractRouteParams, FrameRouter, RouteResolver, RouteTuple } from "./types.ts";

/**
 * Helper to create a type-safe route tuple without needing `as const`
 */
export function frame<R extends Route>(
    r: R,
    resolver: RouteResolver<ExtractRouteParams<R>>,
): RouteTuple<R> {
    return [r, resolver] as const;
}

/**
 * Create a frame router from configuration
 *
 * The config parameter uses a permissive type to allow flexible input,
 * then the const type parameter preserves the exact structure.
 */
export function createFrames<const Config>(config: Config): FrameRouter<Config> {
    // Collect all route tuples from nested config
    const allTuples: Array<{ framePath: string[]; tuple: RouteTuple }> = [];

    function collect(obj: unknown, path: string[] = []) {
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
    const matcher = new TrieMatcher<{
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

        // Find all matches for this frame path
        const matches = matcher.matchAll(urlObj);
        for (const match of matches) {
            if (pathEquals(match.data.framePath, framePath)) {
                return match.data.resolver(match.params, urlObj);
            }
        }

        return null;
    });

    // Generate nested reload API
    const reload = generateNestedAPI(
        config,
        (framePath: string[]) => async (url: URL | string, handle: Handle) => {
            // Navigate through nested resolve API to get the resolver function
            let current = resolve;
            for (const segment of framePath) {
                current = current[segment];
                if (!current) return;
            }

            const frameSource = typeof current === "function" ? current(url) : null;
            if (!frameSource) return;

            const frameName = framePath.join(".");
            const frame = handle.frames.get(frameName);
            if (!frame) return;

            frame.src = frameSource;
            await frame.reload();
        },
    );

    return {
        resolve,
        reload,

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
                if (src) {
                    frameMap.set(frameName, src);
                }
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

        match(url: URL | string | null | undefined) {
            if (!url) return null;
            const urlObj = typeof url === "string" ? new URL(url, "http://localhost") : url;
            const match = matcher.match(urlObj);
            return match ? { params: match.params } : null;
        },

        matchAll(url: URL | string | null | undefined) {
            if (!url) return [];
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
) {
    if (Array.isArray(config)) {
        // Leaf node - create resolver/reload function
        return createLeaf(path);
    }

    // Branch node - recurse
    const result = {} as Record<string, unknown>;
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
