import type { BuildAction } from "remix/fetch-router";
import type { FileUpload } from "remix/form-data-parser";

import { R2FileStorage } from "#/data/adapters/r2-file-storage.ts";
import { routes } from "#/routes.ts";
import { env } from "cloudflare:workers";
import { createFileResponse as sendFile } from "remix/response/file";

// Accessed directly from env because uploadHandler runs during formData
// parsing, before asyncContext and loadFileStorage middleware execute.
let storage = new R2FileStorage(env.FILES);

export const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];

/** Handles file uploads by storing them in R2 and returning a URL. */
export async function uploadHandler(file: FileUpload): Promise<string | undefined> {
    // Empty file inputs still produce a multipart part — skip them
    if (file.size === 0) {
        return undefined;
    }

    if (!new Set(ALLOWED_TYPES).has(file.type)) {
        throw new Response(
            "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
            { status: 415 },
        );
    }

    let ext = file.name.split(".").pop() || "jpg";
    let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    await storage.set(key, file);
    return routes.uploads.href({ key });
}

/** Serves uploaded files from R2. */
export let serveUpload: BuildAction<"GET", typeof routes.uploads> = async ctx => {
    let file = await storage.get(ctx.params.key);

    if (!file) {
        return new Response("File not found", { status: 404 });
    }

    return sendFile(file, ctx.request, {
        cacheControl: "public, max-age=31536000",
    });
};
