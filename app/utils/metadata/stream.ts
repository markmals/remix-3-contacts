import { injectMetadataIntoHtml } from "./ssr.ts";
import type { MetadataManagerOptions } from "./types.ts";

export function stringToStream(value: string): ReadableStream<Uint8Array> {
    let encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(value));
            controller.close();
        },
    });
}

export async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    let reader = stream.getReader();
    let decoder = new TextDecoder();
    let chunks: string[] = [];

    while (true) {
        let read = await reader.read();
        if (read.done) break;
        chunks.push(decoder.decode(read.value, { stream: true }));
    }

    chunks.push(decoder.decode());
    return chunks.join("");
}

export async function renderWithMetadata(
    streamOrPromise: ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>,
    options: MetadataManagerOptions = {},
): Promise<ReadableStream<Uint8Array>> {
    let stream = await streamOrPromise;
    let html = await streamToString(stream);
    return stringToStream(injectMetadataIntoHtml(html, options));
}
