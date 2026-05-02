import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";

import { DryRunAdapter } from "./lib/dry-run-adapter.ts";
import {
    buildSqlFileContents,
    d1MigrationFilename,
    normalizeSqlStatements,
} from "./lib/sql-generation.ts";
import { parseWranglerConfig } from "./lib/wrangler-config.ts";

const TS_MIGRATIONS_DIR = path.resolve("db/migrations");

async function main(): Promise<void> {
    let config = parseWranglerConfig();
    let outputDir = config.d1.migrationsDir;
    mkdirSync(outputDir, { recursive: true });

    let migrations = await loadMigrations(TS_MIGRATIONS_DIR);

    if (migrations.length === 0) {
        throw new Error(`No migrations found in ${TS_MIGRATIONS_DIR}. Refusing to run generator.`);
    }

    console.log(`Generating SQL for ${migrations.length} migration(s) from ${TS_MIGRATIONS_DIR}`);

    // Wipe stale .sql files that no longer correspond to a TS source, so the
    // output dir is a pure function of db/migrations/. Only files matching
    // SQL_FILE_PATTERN are considered generated artifacts; unrelated files
    // (.gitkeep, README.md) are left alone.
    pruneStaleSql(
        outputDir,
        new Set(migrations.map(m => d1MigrationFilename({ id: m.id, name: m.name }))),
    );

    for (let migration of migrations) {
        let adapter = new DryRunAdapter();
        let runner = createMigrationRunner(adapter, [migration]);
        let result = await runner.up({ dryRun: true });

        if (result.sql.length === 0) {
            throw new Error(
                `Migration ${migration.id}_${migration.name} produced no SQL during dry-run. ` +
                    "Did its up() call schema.* operations?",
            );
        }

        let statements = normalizeSqlStatements(result.sql);
        let contents = buildSqlFileContents({
            sourceFilename: path.basename(migration.path ?? migration.id),
            statements,
        });
        let outFile = path.join(
            outputDir,
            d1MigrationFilename({ id: migration.id, name: migration.name }),
        );
        writeFileSync(outFile, contents, "utf-8");
        console.log(`  wrote ${path.relative(process.cwd(), outFile)} (${statements.length} stmt)`);
    }

    console.log("Done.");
}

// Wrangler migration filename pattern: 4-14 digit prefix, underscore, name,
// .sql. Anything else in the output dir we leave alone.
const SQL_FILE_PATTERN = /^\d{4,14}_.+\.sql$/;

function pruneStaleSql(outputDir: string, keep: Set<string>): void {
    for (let entry of readdirSync(outputDir)) {
        if (!SQL_FILE_PATTERN.test(entry)) continue;
        if (keep.has(entry)) continue;
        unlinkSync(path.join(outputDir, entry));
        console.log(`  removed stale ${entry}`);
    }
}

await main();
