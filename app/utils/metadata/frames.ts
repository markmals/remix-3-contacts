import { streamToString, stringToStream } from "./stream.ts";

export type MetadataFrameResponse = string | ReadableStream<Uint8Array>;

export type MetadataResolveFrame = (
    src: string,
    signal: AbortSignal,
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

        if (typeof result === "string") {
            return normalizeFrameHtml(result);
        }

        let html = await streamToString(result);
        return stringToStream(normalizeFrameHtml(html));
    };
}
