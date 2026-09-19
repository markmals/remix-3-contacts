/**
 * Per-page `<title>`/description for frame navigations.
 *
 * A full document render puts these in the document's own `<head>`, and a
 * full-document navigation reconciles that head natively. A *partial* frame
 * swap does not: the runtime parses frame HTML as a fragment and never hoists a
 * nested `<head>` into the document. So the detail frame carries its metadata
 * on the response instead, and the browser applies it as the frame resolves.
 */
export type PageMetadata = {
    description?: string;
    title: string;
};

const TITLE_HEADER = "x-page-title";
const DESCRIPTION_HEADER = "x-page-description";

/**
 * Response headers carrying page metadata. Values are percent-encoded because
 * header values are ASCII-only and contact names are not.
 */
export function pageMetadataHeaders(metadata: PageMetadata): Record<string, string> {
    let headers: Record<string, string> = {
        [TITLE_HEADER]: encodeURIComponent(metadata.title),
    };

    if (metadata.description) {
        headers[DESCRIPTION_HEADER] = encodeURIComponent(metadata.description);
    }

    return headers;
}

/** Applies a frame response's page metadata to the live document. */
export function applyPageMetadata(headers: Headers): void {
    let title = headers.get(TITLE_HEADER);
    if (title === null) return;

    document.title = decodeURIComponent(title);

    let description = headers.get(DESCRIPTION_HEADER);
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');

    if (description === null) {
        meta?.remove();
        return;
    }

    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
    }

    meta.content = decodeURIComponent(description);
}
