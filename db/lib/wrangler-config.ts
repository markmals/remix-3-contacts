import * as JSONC from "@std/jsonc";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as s from "remix/data-schema";

/** Typed shape extracted from `wrangler.jsonc`. */
export interface WranglerConfig {
    /** Path to the config file this was parsed from (absolute). */
    configPath: string;
    /** Cloudflare account id, present when declared at the top level. */
    accountId?: string;
    d1: D1Config;
    r2?: R2Config;
}

export interface D1Config {
    /** D1 binding name from the config (used by `wrangler d1 migrations apply <db>`). */
    binding: string;
    /** Human database name. Either this or `binding` works with wrangler commands. */
    databaseName: string;
    /** Cloudflare-assigned uuid. Not required for migrations-apply. */
    databaseId: string;
    /** Absolute path to the migrations directory (resolved relative to the config file). */
    migrationsDir: string;
}

export interface R2Config {
    binding: string;
    bucketName: string;
}

// Schema for the raw wrangler.jsonc shape. Field names mirror the config
// file, not our typed output — that transform (snake_case → camelCase, path
// resolution, defaults) lives in `parseWranglerConfig` below.
let D1EntrySchema = s.object({
    binding: s.string(),
    database_name: s.string(),
    database_id: s.string(),
    migrations_dir: s.optional(s.string()),
});

let R2EntrySchema = s.object({
    binding: s.string(),
    bucket_name: s.string(),
});

let WranglerConfigSchema = s.object({
    account_id: s.optional(s.string()),
    d1_databases: s.array(D1EntrySchema),
    r2_buckets: s.optional(s.array(R2EntrySchema)),
});

/** Parses `wrangler.jsonc` into a typed, validated `WranglerConfig`. */
export function parseWranglerConfig(configPath = "./wrangler.jsonc"): WranglerConfig {
    let absolute = path.resolve(configPath);
    let text = readFileSync(absolute, "utf-8");
    let raw = JSONC.parse(text);

    // `s.object(...)` would reject a top-level array with a less helpful path
    // ("Expected object"). Check it up front so the error message names the
    // actual problem.
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`wrangler config at ${absolute} is not an object`);
    }

    let parsed: s.InferOutput<typeof WranglerConfigSchema>;
    try {
        parsed = s.parse(WranglerConfigSchema, raw);
    } catch (error) {
        if (error instanceof s.ValidationError) {
            throw new Error(
                `wrangler config at ${absolute} is invalid: ${formatIssues(error.issues)}`,
            );
        }
        throw error;
    }

    if (parsed.d1_databases.length === 0) {
        throw new Error(`wrangler config missing d1_databases[0] in ${absolute}`);
    }

    let d1Raw = parsed.d1_databases[0];
    // Wrangler defaults migrations_dir to "./migrations" relative to the config file.
    let migrationsDirRaw = d1Raw.migrations_dir ?? "./migrations";
    let d1: D1Config = {
        binding: d1Raw.binding,
        databaseName: d1Raw.database_name,
        databaseId: d1Raw.database_id,
        migrationsDir: path.resolve(path.dirname(absolute), migrationsDirRaw),
    };

    let r2: R2Config | undefined;
    if (parsed.r2_buckets && parsed.r2_buckets.length > 0) {
        let r2Raw = parsed.r2_buckets[0];
        r2 = { binding: r2Raw.binding, bucketName: r2Raw.bucket_name };
    }

    return { configPath: absolute, accountId: parsed.account_id, d1, r2 };
}

function formatIssues(issues: ReadonlyArray<s.Issue>): string {
    return issues
        .map(issue => {
            let path = formatPath(issue.path);
            return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join("; ");
}

function formatPath(path: s.Issue["path"]): string {
    if (!path || path.length === 0) return "";
    return path
        .map(segment => {
            let key = typeof segment === "object" ? segment.key : segment;
            return typeof key === "number" ? `[${key}]` : String(key);
        })
        .join(".");
}
