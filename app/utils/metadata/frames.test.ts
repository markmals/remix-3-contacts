import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { normalizeFrameHtml, withMetadataFrames } from "./frames.ts";
import { bufferStream, createStream } from "./stream.ts";

describe("frame metadata helpers", () => {
    it("leaves fragments alone", () => {
        assert.equal(normalizeFrameHtml("<section>Frame</section>"), "<section>Frame</section>");
    });

    it("unwraps full document frame responses to body content", () => {
        assert.equal(
            normalizeFrameHtml(
                "<html><head><title>Ignore</title></head><body><p>Frame</p></body></html>",
            ),
            "<p>Frame</p>",
        );
    });

    it("wraps string frame responses", async () => {
        let resolve = withMetadataFrames(
            async () => "<html><head></head><body><p>Frame</p></body></html>",
        );
        let result = await resolve("/frame", { target: "detail" });

        assert.equal(result, "<p>Frame</p>");
    });

    it("wraps stream frame responses", async () => {
        let resolve = withMetadataFrames(async () =>
            createStream("<html><head></head><body><p>Frame</p></body></html>"),
        );
        let result = await resolve("/frame", { target: "detail" });

        assert.ok(result instanceof ReadableStream);
        assert.equal(await bufferStream(result), "<p>Frame</p>");
    });

    it("passes top-frame responses through untouched", async () => {
        let body = "<html><body><p>Frame</p></body></html><!-- rmx:flush document -->";
        let resolve = withMetadataFrames(async () => body);
        let result = await resolve("/frame");

        assert.equal(result, body);
    });
});
