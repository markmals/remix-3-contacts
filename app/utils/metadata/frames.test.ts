import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { normalizeFrameHtml, withMetadataFrames } from "./frames.ts";
import { streamToString, stringToStream } from "./stream.ts";

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
        let result = await resolve("/frame", new AbortController().signal);

        assert.equal(result, "<p>Frame</p>");
    });

    it("wraps stream frame responses", async () => {
        let resolve = withMetadataFrames(async () =>
            stringToStream("<html><head></head><body><p>Frame</p></body></html>"),
        );
        let result = await resolve("/frame", new AbortController().signal);

        assert.ok(result instanceof ReadableStream);
        assert.equal(await streamToString(result), "<p>Frame</p>");
    });
});
