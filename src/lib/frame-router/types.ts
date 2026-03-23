/** biome-ignore-all lint/suspicious/noExplicitAny: necessary for type inference */
/** biome-ignore-all lint/complexity/noBannedTypes: necessary for type inference */

import type { Handle } from "remix/component";

/**
 * Extract param types from a Route object
 * Returns the type of the first parameter to href(), excluding null/undefined
 */
export type ExtractRouteParams<R> = R extends { href: (...args: infer Args) => any }
    ? Args extends readonly [infer First, ...any[]]
        ? First extends null | undefined
            ? {}
            : Exclude<First, null | undefined>
        : Args extends readonly []
          ? {}
          : {}
    : never;

/**
 * Route resolver function signature
 * Takes extracted params and URL, returns frame source URL
 */
export type RouteResolver<Params = any> = (params: Params, url: URL) => string | null;

/**
 * Route tuple: [route object, resolver function]
 * The resolver's params must match the route's params
 */
export type RouteTuple<R = any> = readonly [R, RouteResolver<ExtractRouteParams<R>>];

/**
 * Frame configuration - nested object or array of route tuples
 */
export type FrameConfig = readonly RouteTuple[] | { [key: string]: FrameConfig };

/**
 * A frame node with resolve, reload, and name
 */
export interface FrameNode {
    resolve(url: URL | string): string | null;
    reload(url: URL | string, handle: Handle): Promise<void>;
    name: string;
}

/**
 * Router-wide utility methods
 */
export interface FrameUtils {
    reloadAll(url: URL | string, handle: Handle): Promise<void>;
    match(
        url: URL | string | null | undefined,
    ): { params: Record<string, string | undefined> } | null;
    matchAll(
        url: URL | string | null | undefined,
    ): Array<{ params: Record<string, string | undefined> }>;
    canIntercept(url: URL | string): boolean;
}

/**
 * Map config structure to frame nodes
 */
export type FrameNodeAPI<Config> = {
    [K in keyof Config]: Config[K] extends readonly any[]
        ? FrameNode
        : Config[K] extends object
          ? FrameNodeAPI<Config[K]>
          : never;
};

/**
 * Frame router instance — frame nodes + $ utilities
 */
export type FrameRouter<Config> = FrameNodeAPI<Config> & { $: FrameUtils };
