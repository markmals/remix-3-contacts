import { UnsupportedMediaTypeError } from "#/utils/uploads.ts";
import { createD1Database } from "@pitlane/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { type Middleware } from "remix/router";

type DatabaseEntry = { key: typeof Database; value: Database };

export function database(): Middleware<DatabaseEntry> {
    // Built once per isolate: the binding is stable, so there is nothing to
    // rebuild per request.
    let db = createD1Database(env.DB);

    return (ctx, next) => {
        ctx.set(Database, db);
        return next();
    };
}

/**
 * Converts the one application error that is raised too early to answer for
 * itself — a rejected upload, thrown while the multipart body is still being
 * parsed by `formData()` — into a response.
 */
export function uploadErrors(): Middleware {
    return async (_ctx, next) => {
        try {
            return await next();
        } catch (error) {
            if (error instanceof UnsupportedMediaTypeError) {
                return new Response(
                    "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
                    { status: 415 },
                );
            }

            throw error;
        }
    };
}
