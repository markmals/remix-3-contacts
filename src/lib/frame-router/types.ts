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
 * Extract param type from resolver function
 */
export type ExtractParams<R> = R extends RouteResolver<infer P> ? P : never;

/**
 * Union all params from array of tuples
 */
export type UnionTupleParams<Tuples extends readonly RouteTuple[]> =
    Tuples[number] extends RouteTuple<infer R> ? ExtractRouteParams<R> : never;

/**
 * Extract all params from a config structure (recursively)
 */
export type UnionAllParams<Config> = Config extends readonly any[]
    ? Config[number] extends readonly [infer R, any]
        ? ExtractRouteParams<R>
        : never
    : Config extends object
      ? { [K in keyof Config]: UnionAllParams<Config[K]> }[keyof Config]
      : never;

/**
 * Convert a union type to an intersection type
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

/**
 * Strip index signatures from a type to get only known properties
 */
type StripIndexSignature<T> = {
    [K in keyof T as string extends K
        ? never
        : number extends K
          ? never
          : symbol extends K
            ? never
            : K]: T[K];
};

/**
 * Merge all params from union into a single object with optional properties
 * Strips index signatures, filters out empty objects, intersects the rest, makes properties optional
 */
export type MergedParams<T> = Partial<
    UnionToIntersection<
        T extends infer U
            ? [keyof StripIndexSignature<U>] extends [never]
                ? never
                : StripIndexSignature<U>
            : never
    >
>;

/**
 * Generate nested resolve API from config
 */
export type ResolveAPI<Config> = {
    [K in keyof Config]: Config[K] extends readonly any[]
        ? (url: URL | string) => string | null
        : Config[K] extends object
          ? ResolveAPI<Config[K]>
          : never;
};

/**
 * Generate nested reload API from config
 */
export type ReloadAPI<Config> = {
    [K in keyof Config]: Config[K] extends readonly any[]
        ? (url: URL | string, handle: Handle) => Promise<void>
        : Config[K] extends object
          ? ReloadAPI<Config[K]>
          : never;
};

/**
 * Frame router instance with generated API
 */
export interface FrameRouter<Config> {
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
     * Returns null if url is null/undefined or if no route matches
     */
    match(
        url: URL | string | null | undefined,
    ): { params: Record<string, string | undefined> } | null;

    /**
     * Match URL and return all matching params
     */
    matchAll(
        url: URL | string | null | undefined,
    ): Array<{ params: Record<string, string | undefined> }>;

    /**
     * Check if URL matches any configured route
     */
    canIntercept(url: URL | string): boolean;
}
