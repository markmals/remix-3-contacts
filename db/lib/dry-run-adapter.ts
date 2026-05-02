import type {
    AdapterCapabilities,
    DataManipulationOperation,
    DataManipulationRequest,
    DataManipulationResult,
    DataMigrationOperation,
    DataMigrationRequest,
    DataMigrationResult,
    DatabaseAdapter,
    SqlStatement,
    TableRef,
    TransactionOptions,
    TransactionToken,
} from "remix/data-table";

import { SqliteDatabaseAdapter } from "remix/data-table-sqlite";

// The SQLite adapter's compileSql is pure SQL generation — it never touches
// the database instance, so null is safe here. We reuse the exact same
// compiler as the runtime D1 adapter so generated SQL matches D1 dialect.
let compiler = new SqliteDatabaseAdapter(null as never);

// Mirror D1DatabaseAdapter's capability flags so migrations compile with the
// same adapter behavior they'd encounter against D1 at runtime.
const CAPABILITIES: AdapterCapabilities = {
    returning: true,
    savepoints: false,
    upsert: true,
    transactionalDdl: false,
    migrationLock: false,
};

/**
 * A minimal DatabaseAdapter used only for `runner.up({ dryRun: true })`.
 *
 * The migration runner, when in dry-run mode, probes for the journal by
 * calling `adapter.execute` on a raw SELECT and catching any thrown
 * exception — so this adapter's `execute` throw is intentional and is
 * caught by the runner's `hasMigrationJournal` helper, which returns
 * `false`, causing every migration to be treated as pending. `hasTable`
 * and `hasColumn` return `false` to support migrations that guard on
 * schema existence before emitting DDL.
 */
export class DryRunAdapter implements DatabaseAdapter {
    dialect = "sqlite";
    capabilities: AdapterCapabilities = { ...CAPABILITIES };

    compileSql(operation: DataManipulationOperation | DataMigrationOperation): SqlStatement[] {
        return compiler.compileSql(operation);
    }

    async hasTable(_table: TableRef, _transaction?: TransactionToken): Promise<boolean> {
        return false;
    }

    async hasColumn(
        _table: TableRef,
        _column: string,
        _transaction?: TransactionToken,
    ): Promise<boolean> {
        return false;
    }

    async execute(_request: DataManipulationRequest): Promise<DataManipulationResult> {
        throw new Error(
            "DryRunAdapter.execute called: migration uses db.* data operations and cannot be dry-run to SQL. Migrations must use only schema.* operations. Move data-population logic to db/seed.ts.",
        );
    }

    async migrate(_request: DataMigrationRequest): Promise<DataMigrationResult> {
        throw new Error("DryRunAdapter.migrate should never be called in dry-run mode");
    }

    async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
        throw new Error("DryRunAdapter does not support transactions");
    }

    async commitTransaction(_token: TransactionToken): Promise<void> {
        throw new Error("DryRunAdapter does not support transactions");
    }

    async rollbackTransaction(_token: TransactionToken): Promise<void> {
        throw new Error("DryRunAdapter does not support transactions");
    }

    async createSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error("DryRunAdapter does not support savepoints");
    }

    async rollbackToSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error("DryRunAdapter does not support savepoints");
    }

    async releaseSavepoint(_token: TransactionToken, _name: string): Promise<void> {
        throw new Error("DryRunAdapter does not support savepoints");
    }
}
