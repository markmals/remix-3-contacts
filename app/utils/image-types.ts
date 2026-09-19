import { detectMimeType } from "remix/mime";

/** Allowed image types, mapped to the extension used for a stored key. */
const EXTENSION_BY_TYPE: Record<string, string> = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/svg+xml": "svg",
    "image/webp": "webp",
};

/** Value for a file input's `accept` attribute. */
export const ALLOWED_TYPES = Object.keys(EXTENSION_BY_TYPE);

/**
 * The extension to store an uploaded image under, or `undefined` when it is not
 * an image this app accepts.
 *
 * Two independent client-supplied signals have to agree: the multipart
 * `Content-Type` and the filename's extension. `detectMimeType()` maps the
 * extension — it does not read the bytes — so this narrows what may be stored
 * without proving what the file actually contains.
 *
 * Returning the allowlist's extension rather than the filename's is also what
 * keeps a name like `evil.j/pg` from smuggling a path segment into the key.
 */
export function imageExtension(filename: string, declaredType: string): string | undefined {
    let type = detectMimeType(filename);
    if (type === undefined || type !== declaredType) return undefined;
    return EXTENSION_BY_TYPE[type];
}
