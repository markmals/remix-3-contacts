import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { collectNormalizedEntriesFromHtml, injectMetadataIntoHtml } from "./ssr.ts";
import { createTransportHtml } from "./transport.ts";

describe("SSR metadata injection", () => {
    it("collects normalized entries from transport templates", () => {
        let marker = createTransportHtml({
            owner: "page",
            entries: [{ type: "title", props: {}, children: "Page" }],
        });

        assert.deepEqual(collectNormalizedEntriesFromHtml(marker), [
            {
                type: "title",
                props: {},
                children: "Page",
                owner: "page",
                key: "title",
                lifecycle: "replaceable",
            },
        ]);
    });

    it("injects supported metadata before closing head", () => {
        let marker = createTransportHtml({
            owner: "page",
            entries: [
                { type: "title", props: {}, children: "Page", order: 0 },
                { type: "meta", props: { name: "description", content: "Description" }, order: 1 },
            ],
        });

        let html = injectMetadataIntoHtml(`<html><head></head><body>${marker}</body></html>`);

        assert.ok(html.includes('<meta data-pitlane-metadata-managed="true"'));
        assert.ok(html.includes('<title data-pitlane-metadata-managed="true"'));
        assert.ok(html.includes(">Page</title>"));
        assert.ok(html.includes(marker));
    });

    it("throws when there is no document head", () => {
        assert.throws(() => injectMetadataIntoHtml("<html><body></body></html>"), {
            message: "Cannot inject metadata: missing closing </head> tag",
        });
    });
});
