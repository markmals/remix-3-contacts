import type { BuildAction } from "remix/fetch-router";
import type { FileUpload } from "remix/form-data-parser";

import { R2FileStorage } from "#/data/adapters/r2-file-storage.ts";
import { routes } from "#/routes.ts";
import { getContext } from "remix/async-context-middleware";
import { createFileResponse as sendFile } from "remix/response/file";

/** Handles file uploads by storing them in R2 and returning a URL. */
export async function uploadHandler(file: FileUpload): Promise<string> {
    let ctx = getContext();
    let storage = ctx.get(R2FileStorage);
    let ext = file.name.split(".").pop() || "jpg";
    let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    await storage.set(key, file);

    return `/uploads/${key}`;
}

/** Serves uploaded files from R2. */
export let serveUpload: BuildAction<"GET", typeof routes.uploads> = async ctx => {
    let storage = ctx.get(R2FileStorage);
    let file = await storage.get(ctx.params.key);

    if (!file) {
        return new Response("File not found", { status: 404 });
    }

    return sendFile(file, ctx.request, {
        cacheControl: "public, max-age=31536000",
    });
};
