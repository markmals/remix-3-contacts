import type { MetadataManagerOptions } from "./types.ts";

import { injectMetadataIntoHtml } from "./ssr.ts";

export function createStream(value: string): ReadableStream<Uint8Array> {
    let encoder = new TextEncoder();

    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(value));
            controller.close();
        },
    });
}

export async function bufferStream(stream: ReadableStream<Uint8Array>): Promise<string> {
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
    let html = await bufferStream(stream);
    return createStream(injectMetadataIntoHtml(html, options));
}
