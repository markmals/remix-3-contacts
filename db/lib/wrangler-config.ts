import * as JSONC from "@std/jsonc";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as s from "remix/data-schema";

/** The parts of `wrangler.jsonc` the db scripts need. */
export interface WranglerConfig {
    /** Path to the config file this was parsed from (absolute). */
    configPath: string;
    d1: D1Config;
}

export interface D1Config {
    /** D1 binding name, passed to `wrangler d1 migrations apply <binding>`. */
    binding: string;
    /** Absolute path to the migrations directory, resolved against the config file. */
    migrationsDir: string;
}

// Schema for the raw wrangler.jsonc shape. Field names mirror the config file,
// not our typed output — that transform (snake_case → camelCase, path
// resolution, defaults) lives in `parseWranglerConfig` below.
let D1EntrySchema = s.object({
    binding: s.string(),
    migrations_dir: s.optional(s.string()),
});

let WranglerConfigSchema = s.object({
    d1_databases: s.array(D1EntrySchema),
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

    return {
        configPath: absolute,
        d1: {
            binding: d1Raw.binding,
            migrationsDir: path.resolve(path.dirname(absolute), migrationsDirRaw),
        },
    };
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
