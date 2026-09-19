/**
 * Name of the frame a request is targeting, or `null` for a normal navigation.
 *
 * Both headers are required. `X-Remix-Target` alone is not enough: a stray
 * target header on a top-level navigation would otherwise be served fragment
 * content in place of a whole document.
 */
export function frameTarget(headers: Headers): string | null {
    if (headers.get("x-remix-frame") !== "true") return null;
    return headers.get("x-remix-target");
}
