import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
    createTransportHtml,
    extractTransportTemplates,
    parseTransportTemplate,
    stripTransportTemplates,
} from "./transport.ts";

describe("metadata transport", () => {
    it("serializes entries into an inert template", () => {
        let html = createTransportHtml({
            owner: "owner-1",
            entries: [{ type: "title", props: {}, children: "A < B" }],
        });

        assert.ok(html.includes('<template data-pitlane-metadata="true"'));
        assert.ok(html.includes('data-pitlane-metadata-owner="owner-1"'));
        assert.ok(html.includes("\\u003c"));
    });

    it("parses template HTML back into entries", () => {
        let html = createTransportHtml({
            owner: "owner-1",
            entries: [{ type: "title", props: {}, children: "Hello" }],
        });

        assert.deepEqual(parseTransportTemplate(html), {
            owner: "owner-1",
            entries: [{ type: "title", props: {}, children: "Hello" }],
        });
    });

    it("extracts and strips templates", () => {
        let one = createTransportHtml({
            owner: "one",
            entries: [{ type: "title", props: {}, children: "One" }],
        });
        let two = createTransportHtml({
            owner: "two",
            entries: [{ type: "meta", props: { name: "description", content: "Two" } }],
        });
        let html = `<html><body>${one}<main>x</main>${two}</body></html>`;

        assert.deepEqual(extractTransportTemplates(html), [
            { owner: "one", entries: [{ type: "title", props: {}, children: "One" }] },
            {
                owner: "two",
                entries: [{ type: "meta", props: { name: "description", content: "Two" } }],
            },
        ]);
        assert.equal(stripTransportTemplates(html), "<html><body><main>x</main></body></html>");
    });
});
