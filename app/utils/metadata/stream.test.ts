import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { renderWithMetadata, createStream, bufferStream } from "./stream.ts";
import { createTransportHtml } from "./transport.ts";

describe("metadata stream wrapper", () => {
    it("converts strings to streams and streams to strings", async () => {
        assert.equal(await bufferStream(createStream("hello")), "hello");
    });

    it("injects metadata into a render stream", async () => {
        let marker = createTransportHtml({
            owner: "page",
            entries: [{ type: "title", props: {}, children: "Streamed" }],
        });

        let stream = await renderWithMetadata(
            Promise.resolve(createStream(`<html><head></head><body>${marker}</body></html>`)),
        );

        let html = await bufferStream(stream);

        assert.ok(html.includes("<title"));
        assert.ok(html.includes(">Streamed</title>"));
    });
});
