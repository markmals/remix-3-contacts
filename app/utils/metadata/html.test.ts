import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderHeadEntriesToHtml, renderHeadEntryToHtml } from "./html.ts";
import type { NormalizedMetadataEntry } from "./types.ts";

function normalized(
    entry: Omit<NormalizedMetadataEntry, "owner" | "lifecycle"> & {
        owner?: string;
        lifecycle?: NormalizedMetadataEntry["lifecycle"];
    },
): NormalizedMetadataEntry {
    return {
        owner: "owner-1",
        lifecycle: "replaceable",
        ...entry,
    };
}

describe("head HTML rendering", () => {
    it("renders managed title with escaped text", () => {
        assert.equal(
            renderHeadEntryToHtml(
                normalized({
                    type: "title",
                    key: "title",
                    props: {},
                    children: "A < B",
                }),
            ),
            '<title data-pitlane-metadata-managed="true" data-pitlane-metadata-owner="owner-1" data-pitlane-metadata-key="title">A &lt; B</title>',
        );
    });

    it("renders managed meta with escaped attributes", () => {
        assert.equal(
            renderHeadEntryToHtml(
                normalized({
                    type: "meta",
                    key: "meta:name:description",
                    props: { name: "description", content: 'A "quote"' },
                }),
            ),
            '<meta data-pitlane-metadata-managed="true" data-pitlane-metadata-owner="owner-1" data-pitlane-metadata-key="meta:name:description" name="description" content="A &quot;quote&quot;">',
        );
    });

    it("renders sticky script lifecycle and boolean attributes", () => {
        assert.equal(
            renderHeadEntryToHtml(
                normalized({
                    type: "script",
                    key: "script:/app.js",
                    lifecycle: "sticky",
                    props: { src: "/app.js", async: true },
                }),
            ),
            '<script data-pitlane-metadata-managed="true" data-pitlane-metadata-owner="owner-1" data-pitlane-metadata-key="script:/app.js" data-pitlane-metadata-lifecycle="sticky" src="/app.js" async></script>',
        );
    });

    it("dedupes replaceable entries by last writer", () => {
        let html = renderHeadEntriesToHtml([
            normalized({ type: "title", key: "title", props: {}, children: "Old", order: 0 }),
            normalized({ type: "title", key: "title", props: {}, children: "New", order: 1 }),
        ]);

        assert.ok(html.includes(">New</title>"));
        assert.equal(html.includes(">Old</title>"), false);
    });
});
