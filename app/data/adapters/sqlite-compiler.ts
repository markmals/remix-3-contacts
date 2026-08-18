import type {
    AnyTable,
    DataManipulationOperation,
    Predicate,
    SqlStatement,
} from "remix/data-table";

import { getTableName, getTablePrimaryKey } from "remix/data-table";
import {
    collectColumns,
    normalizeJoinType,
    quotePath as quotePathWithQuoter,
} from "remix/data-table/sql-helpers";

// Faithful port of Remix's internal SQLite SQL compiler
// (`@remix-run/data-table-sqlite`'s `compileSqliteOperation`). Beta.10 stopped
// exporting the SQLite driver, so the D1 driver — which speaks SQLite SQL but
// executes over Cloudflare's async binding — has to own compilation. It depends
// only on the public `remix/data-table` and `remix/data-table/sql-helpers`
// surfaces, so it stays in lockstep with the operation shapes the framework
// hands drivers.

type Operation<kind extends DataManipulationOperation["kind"]> = Extract<
    DataManipulationOperation,
    { kind: kind }
>;
type Returning = Operation<"insert">["returning"];
type CompileContext = { values: unknown[] };

const IDENTIFIER_QUOTE_RE = /"/g;

/** Compiles a data-manipulation operation into a single SQLite statement. */
export function compileSqliteOperation(operation: DataManipulationOperation): SqlStatement {
    if (operation.kind === "raw") {
        return { text: operation.sql.text, values: [...operation.sql.values] };
    }

    let context: CompileContext = { values: [] };

    if (operation.kind === "select") {
        let selection = "*";
        if (operation.select !== "*") {
            selection = operation.select
                .map(field => quotePath(field.column) + " as " + quoteIdentifier(field.alias))
                .join(", ");
        }
        return {
            text:
                "select " +
                (operation.distinct ? "distinct " : "") +
                selection +
                compileFromClause(operation.table, operation.joins, context) +
                compileWhereClause(operation.where, context) +
                compileGroupByClause(operation.groupBy) +
                compileHavingClause(operation.having, context) +
                compileOrderByClause(operation.orderBy) +
                compileLimitClause(operation.limit, context) +
                compileOffsetClause(operation.offset, context),
            values: context.values,
        };
    }

    if (operation.kind === "count" || operation.kind === "exists") {
        let inner =
            "select 1" +
            compileFromClause(operation.table, operation.joins, context) +
            compileWhereClause(operation.where, context) +
            compileGroupByClause(operation.groupBy) +
            compileHavingClause(operation.having, context);
        return {
            text:
                "select count(*) as " +
                quoteIdentifier("count") +
                " from (" +
                inner +
                ") as " +
                quoteIdentifier("__dt_count"),
            values: context.values,
        };
    }

    if (operation.kind === "insert") {
        return compileInsertOperation(
            operation.table,
            operation.values,
            operation.returning,
            context,
        );
    }

    if (operation.kind === "insertMany") {
        return compileInsertManyOperation(
            operation.table,
            operation.values,
            operation.returning,
            context,
        );
    }

    if (operation.kind === "update") {
        let columns = Object.keys(operation.changes);
        return {
            text:
                "update " +
                quotePath(getTableName(operation.table)) +
                " set " +
                columns
                    .map(
                        column =>
                            quotePath(column) +
                            " = " +
                            pushValue(context, operation.changes[column]),
                    )
                    .join(", ") +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning),
            values: context.values,
        };
    }

    if (operation.kind === "delete") {
        return {
            text:
                "delete from " +
                quotePath(getTableName(operation.table)) +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning),
            values: context.values,
        };
    }

    return compileUpsertOperation(operation, context);
}

function compileInsertOperation(
    table: AnyTable,
    values: Record<string, unknown>,
    returning: Returning,
    context: CompileContext,
): SqlStatement {
    let columns = Object.keys(values);
    if (columns.length === 0) {
        return {
            text:
                "insert into " +
                quotePath(getTableName(table)) +
                " default values" +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    return {
        text:
            "insert into " +
            quotePath(getTableName(table)) +
            " (" +
            columns.map(column => quotePath(column)).join(", ") +
            ") values (" +
            columns.map(column => pushValue(context, values[column])).join(", ") +
            ")" +
            compileReturningClause(returning),
        values: context.values,
    };
}

function compileInsertManyOperation(
    table: AnyTable,
    rows: Record<string, unknown>[],
    returning: Returning,
    context: CompileContext,
): SqlStatement {
    if (rows.length === 0) {
        return { text: "select 0 where 1 = 0", values: context.values };
    }
    let columns = collectColumns(rows);
    if (columns.length === 0) {
        return {
            text:
                "insert into " +
                quotePath(getTableName(table)) +
                " default values" +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    return {
        text:
            "insert into " +
            quotePath(getTableName(table)) +
            " (" +
            columns.map(column => quotePath(column)).join(", ") +
            ") values " +
            rows
                .map(
                    row =>
                        "(" +
                        columns
                            .map(column => {
                                let value = Object.prototype.hasOwnProperty.call(row, column)
                                    ? row[column]
                                    : null;
                                return pushValue(context, value);
                            })
                            .join(", ") +
                        ")",
                )
                .join(", ") +
            compileReturningClause(returning),
        values: context.values,
    };
}

function compileUpsertOperation(
    operation: Operation<"upsert">,
    context: CompileContext,
): SqlStatement {
    let insertColumns = Object.keys(operation.values);
    let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)];
    if (insertColumns.length === 0) {
        throw new Error("upsert requires at least one value");
    }
    let updateValues = operation.update ?? operation.values;
    let updateColumns = Object.keys(updateValues);
    let conflictClause = "";
    if (updateColumns.length === 0) {
        conflictClause =
            " on conflict (" +
            conflictTarget.map(column => quotePath(column)).join(", ") +
            ") do nothing";
    } else {
        conflictClause =
            " on conflict (" +
            conflictTarget.map(column => quotePath(column)).join(", ") +
            ") do update set " +
            updateColumns
                .map(column => quotePath(column) + " = " + pushValue(context, updateValues[column]))
                .join(", ");
    }
    return {
        text:
            "insert into " +
            quotePath(getTableName(operation.table)) +
            " (" +
            insertColumns.map(column => quotePath(column)).join(", ") +
            ") values (" +
            insertColumns.map(column => pushValue(context, operation.values[column])).join(", ") +
            ")" +
            conflictClause +
            compileReturningClause(operation.returning),
        values: context.values,
    };
}

function compileFromClause(
    table: AnyTable,
    joins: Operation<"select">["joins"],
    context: CompileContext,
): string {
    let output = " from " + quotePath(getTableName(table));
    for (let join of joins) {
        output +=
            " " +
            normalizeJoinType(join.type) +
            " join " +
            quotePath(getTableName(join.table)) +
            " on " +
            compilePredicate(join.on, context);
    }
    return output;
}

function compileWhereClause(predicates: Predicate[], context: CompileContext): string {
    if (predicates.length === 0) return "";
    return (
        " where " +
        predicates.map(predicate => "(" + compilePredicate(predicate, context) + ")").join(" and ")
    );
}

function compileGroupByClause(columns: string[]): string {
    if (columns.length === 0) return "";
    return " group by " + columns.map(column => quotePath(column)).join(", ");
}

function compileHavingClause(predicates: Predicate[], context: CompileContext): string {
    if (predicates.length === 0) return "";
    return (
        " having " +
        predicates.map(predicate => "(" + compilePredicate(predicate, context) + ")").join(" and ")
    );
}

function compileOrderByClause(orderBy: Operation<"select">["orderBy"]): string {
    if (orderBy.length === 0) return "";
    return (
        " order by " +
        orderBy
            .map(clause => quotePath(clause.column) + " " + clause.direction.toUpperCase())
            .join(", ")
    );
}

function compileLimitClause(limit: number | undefined, context: CompileContext): string {
    if (limit === undefined) return "";
    return " limit " + pushValue(context, limit);
}

function compileOffsetClause(offset: number | undefined, context: CompileContext): string {
    if (offset === undefined) return "";
    return " offset " + pushValue(context, offset);
}

function compileReturningClause(returning: Returning): string {
    if (!returning) return "";
    if (returning === "*") return " returning *";
    return " returning " + returning.map(column => quotePath(column)).join(", ");
}

function compilePredicate(predicate: Predicate, context: CompileContext): string {
    if (predicate.type === "comparison") {
        let column = quotePath(predicate.column);
        if (predicate.operator === "eq") {
            if (predicate.valueType === "value" && predicate.value == null) {
                return column + " is null";
            }
            return column + " = " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "ne") {
            if (predicate.valueType === "value" && predicate.value == null) {
                return column + " is not null";
            }
            return column + " <> " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "gt") {
            return column + " > " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "gte") {
            return column + " >= " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "lt") {
            return column + " < " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "lte") {
            return column + " <= " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "in" || predicate.operator === "notIn") {
            let values = Array.isArray(predicate.value) ? predicate.value : [];
            if (values.length === 0) {
                return predicate.operator === "in" ? "1 = 0" : "1 = 1";
            }
            let keyword = predicate.operator === "in" ? "in" : "not in";
            return (
                column +
                " " +
                keyword +
                " (" +
                values.map(value => pushValue(context, value)).join(", ") +
                ")"
            );
        }
        if (predicate.operator === "like") {
            return column + " like " + compileComparisonValue(predicate, context);
        }
        if (predicate.operator === "ilike") {
            return (
                "lower(" +
                column +
                ") like lower(" +
                compileComparisonValue(predicate, context) +
                ")"
            );
        }
    }

    if (predicate.type === "between") {
        return (
            quotePath(predicate.column) +
            " between " +
            pushValue(context, predicate.lower) +
            " and " +
            pushValue(context, predicate.upper)
        );
    }

    if (predicate.type === "null") {
        return (
            quotePath(predicate.column) +
            (predicate.operator === "isNull" ? " is null" : " is not null")
        );
    }

    if (predicate.type === "logical") {
        if (predicate.predicates.length === 0) {
            return predicate.operator === "and" ? "1 = 1" : "1 = 0";
        }
        let joiner = predicate.operator === "and" ? " and " : " or ";
        return predicate.predicates
            .map(child => "(" + compilePredicate(child, context) + ")")
            .join(joiner);
    }

    throw new Error("Unsupported predicate");
}

function compileComparisonValue(
    predicate: Extract<Predicate, { type: "comparison" }>,
    context: CompileContext,
): string {
    if (predicate.valueType === "column") {
        return quotePath(predicate.value);
    }
    return pushValue(context, predicate.value);
}

function quoteIdentifier(value: string): string {
    return '"' + value.replace(IDENTIFIER_QUOTE_RE, '""') + '"';
}

function quotePath(path: string): string {
    return quotePathWithQuoter(path, quoteIdentifier);
}

function pushValue(context: CompileContext, value: unknown): string {
    // SQLite has no boolean type; bind booleans as their 1/0 integer form.
    context.values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
    return "?";
}
