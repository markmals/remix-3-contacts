import { bufferStream, createStream } from "./stream.ts";

export type MetadataFrameResponse = string | ReadableStream<Uint8Array>;

export type MetadataResolveFrame = (
    src: string,
    signal?: AbortSignal,
    target?: string | null,
    context?: unknown,
) => MetadataFrameResponse | Promise<MetadataFrameResponse>;

const BODY_RE = /<body\b[^>]*>([\s\S]*?)<\/body>/i;

export function normalizeFrameHtml(html: string): string {
    let bodyMatch = html.match(BODY_RE);
    return bodyMatch ? bodyMatch[1] : html;
}

export function withMetadataFrames(resolveFrame: MetadataResolveFrame): MetadataResolveFrame {
    return async (src, signal, target, context) => {
        let result = await resolveFrame(src, signal, target, context);

        // Top-frame responses are full HTML documents and carry the trailing
        // `<!-- rmx:flush document -->` marker that drives the runtime's
        // document-level diff. Stripping the body would also strip that marker
        // and force a fragment diff against the document, which fails because
        // elements can't be inserted before the doctype.
        if (!target) return result;

        if (typeof result === "string") {
            return normalizeFrameHtml(result);
        }

        let html = await bufferStream(result);
        return createStream(normalizeFrameHtml(html));
    };
}
