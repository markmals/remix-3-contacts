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
            for (const tuple of obj) {
                allTuples.push({ framePath: path, tuple });
            }
        } else if (typeof obj === "object" && obj !== null) {
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

        if (!route?.pattern) {
            throw new Error(
                `Route object must have a 'pattern' property: ${JSON.stringify(route)}`,
            );
        }

        matcher.add(route.pattern, { framePath, resolver });
    }

    // Build frame nodes from config
    const nodes = generateFrameNodes(config, (framePath: string[]) => {
        const frameName = framePath.join("-");

        function resolve(url: URL | string): string | null {
            const urlObj = toURL(url);
            const matches = matcher.matchAll(urlObj);
            for (const match of matches) {
                if (pathEquals(match.data.framePath, framePath)) {
                    return match.data.resolver(match.params, urlObj);
                }
            }
            return null;
        }

        return {
            name: frameName,
            resolve,

            async reload(url: URL | string, handle: Handle) {
                const frameSource = resolve(url);
                if (!frameSource) return;

                const frame = handle.frames.get(frameName);
                if (!frame) return;

                frame.src = frameSource;
                await frame.reload();
            },
        };
    });

    // Attach $ utilities
    const result = nodes as FrameRouter<Config>;
    (result as any).$ = {
        async reloadAll(url: URL | string, handle: Handle) {
            const urlObj = toURL(url);
            const matches = matcher.matchAll(urlObj);

            // Group by frame name to avoid duplicate reloads
            const frameMap = new Map<string, string>();

            for (const match of matches) {
                const { framePath, resolver } = match.data;
                const frameName = framePath.join("-");
                const src = resolver(match.params, urlObj);
                if (src) {
                    frameMap.set(frameName, src);
                }
            }

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
            const urlObj = toURL(url);
            const match = matcher.match(urlObj);
            return match ? { params: match.params } : null;
        },

        matchAll(url: URL | string | null | undefined) {
            if (!url) return [];
            const urlObj = toURL(url);
            const matches = matcher.matchAll(urlObj);
            return matches.map(m => ({ params: m.params }));
        },

        canIntercept(url: URL | string) {
            const urlObj = toURL(url);
            return matcher.match(urlObj) !== null;
        },
    };

    return result;
}

/**
 * Parse URL input to URL object
 */
function toURL(url: URL | string): URL {
    return typeof url === "string" ? new URL(url, "http://localhost") : url;
}

/**
 * Build frame node objects from config structure
 */
function generateFrameNodes(
    config: any,
    createLeaf: (framePath: string[]) => any,
    path: string[] = [],
): any {
    if (Array.isArray(config)) {
        return createLeaf(path);
    }

    const result = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(config)) {
        result[key] = generateFrameNodes(value, createLeaf, [...path, key]);
    }
    return result;
}

/**
 * Check if two paths are equal
 */
function pathEquals(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}
