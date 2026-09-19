import type { FileUpload } from "remix/form-data-parser";

import { R2FileStorage } from "#/data/adapters/r2-file-storage.ts";
import { routes } from "#/routes.ts";
import { env } from "cloudflare:workers";

const ALLOWED_TYPE: Record<string, true> = {
    "image/avif": true,
    "image/gif": true,
    "image/jpeg": true,
    "image/png": true,
    "image/svg+xml": true,
    "image/webp": true,
};

/** Value for a file input's `accept` attribute. */
export const ALLOWED_TYPES = Object.keys(ALLOWED_TYPE);

export let uploadStorage = new R2FileStorage(env.FILES);

/**
 * Thrown while the form body is still streaming, so it cannot be turned into a
 * response at the throw site. {@link uploadErrors} converts it to a 415.
 */
export class UnsupportedMediaTypeError extends Error {
    constructor(type: string) {
        super(`Unsupported image format: ${type}`);
        this.name = "UnsupportedMediaTypeError";
    }
}

/** Stores an upload in R2 and returns the URL used as the form field's value. */
export async function uploadHandler(file: FileUpload): Promise<string | undefined> {
    // Empty file inputs still produce a multipart part — skip them
    if (file.size === 0) {
        return undefined;
    }

    if (!ALLOWED_TYPE[file.type]) {
        throw new UnsupportedMediaTypeError(file.type);
    }

    let ext = file.name.split(".").pop() || "jpg";
    let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    await uploadStorage.set(key, file);
    return routes.uploads.href({ key });
}
