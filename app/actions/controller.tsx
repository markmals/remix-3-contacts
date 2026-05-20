import type { FileUpload } from "remix/form-data-parser";

import { Document } from "#/components/Document.tsx";
import { ZeroState } from "#/components/ZeroState.tsx";
import { R2FileStorage } from "#/data/adapters/r2-file-storage.ts";
import { routes } from "#/routes.ts";
import { frame, render, renderDocument } from "#/utils/render.tsx";
import { env } from "cloudflare:workers";
import { createFileResponse as sendFile } from "remix/response/file";
import { createHtmlResponse as html } from "remix/response/html";
import { createController } from "remix/router";

import { sidebar } from "./sidebar.tsx";

let storage = new R2FileStorage(env.FILES);

export const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];

const ALLOWED_TYPE_SET = new Set(ALLOWED_TYPES);

/** Handles file uploads by storing them in R2 and returning a URL. */
export async function uploadHandler(file: FileUpload): Promise<string | undefined> {
    // Empty file inputs still produce a multipart part — skip them
    if (file.size === 0) {
        return undefined;
    }

    if (!ALLOWED_TYPE_SET.has(file.type)) {
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

export default createController(routes, {
    actions: {
        async home(ctx) {
            if (ctx.headers.get("x-remix-target") === "sidebar") return sidebar();
            if (ctx.headers.get("x-remix-target") === "detail") {
                return frame(render(<ZeroState />));
            }
            return html(await renderDocument(<Document />));
        },
        async uploads(ctx) {
            let file = await storage.get(ctx.params.key);

            if (!file) {
                return new Response("File not found", { status: 404 });
            }

            return sendFile(file, ctx.request, {
                cacheControl: "public, max-age=31536000",
            });
        },
    },
});
