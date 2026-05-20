import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import type { MetadataEntry } from "./types.ts";

import { deriveEntryKey, getEntryLifecycle, isSupportedEntry, normalizeEntry } from "./rules.ts";

function entry(type: MetadataEntry["type"], props: MetadataEntry["props"] = {}): MetadataEntry {
    return { type, props };
}

describe("metadata rules", () => {
    it("derives stable entry keys", () => {
        assert.equal(deriveEntryKey(entry("title")), "title");
        assert.equal(deriveEntryKey(entry("meta", { charset: "utf-8" })), "meta:charset");
        assert.equal(
            deriveEntryKey(entry("meta", { name: "description" })),
            "meta:name:description",
        );
        assert.equal(
            deriveEntryKey(entry("meta", { property: "og:title" })),
            "meta:property:og:title",
        );
        assert.equal(
            deriveEntryKey(entry("meta", { httpEquiv: "refresh" })),
            "meta:http-equiv:refresh",
        );
        assert.equal(
            deriveEntryKey(entry("link", { rel: "canonical", href: "/x" })),
            "link:canonical",
        );
        assert.equal(
            deriveEntryKey(entry("link", { rel: "preload", href: "/font.woff2" })),
            "link:preload:/font.woff2",
        );
        assert.equal(deriveEntryKey(entry("style", { href: "inline:x" })), "style:inline:x");
        assert.equal(
            deriveEntryKey(entry("script", { src: "/app.js", async: true })),
            "script:/app.js",
        );
    });

    it("honors explicit keys", () => {
        assert.equal(
            deriveEntryKey({ type: "meta", key: "custom", props: { name: "x" } }),
            "custom",
        );
    });

    it("rejects unsupported React 19 metadata/resource cases", () => {
        assert.equal(isSupportedEntry(entry("meta", { itemProp: "name", content: "A" })), false);
        assert.equal(
            isSupportedEntry(entry("link", { rel: "stylesheet", href: "/app.css" })),
            false,
        );
        assert.equal(
            isSupportedEntry(
                entry("link", { rel: "stylesheet", href: "/app.css", precedence: "base" }),
            ),
            true,
        );
        assert.equal(isSupportedEntry(entry("style", { href: "inline:x" })), false);
        assert.equal(
            isSupportedEntry(entry("style", { href: "inline:x", precedence: "component" })),
            true,
        );
        assert.equal(isSupportedEntry(entry("script", { src: "/sync.js" })), false);
        assert.equal(isSupportedEntry(entry("script", { src: "/async.js", async: true })), true);
    });

    it("assigns replaceable and sticky lifecycles", () => {
        assert.equal(getEntryLifecycle(entry("title")), "replaceable");
        assert.equal(getEntryLifecycle(entry("meta", { name: "description" })), "replaceable");
        assert.equal(
            getEntryLifecycle(entry("link", { rel: "canonical", href: "/x" })),
            "replaceable",
        );
        assert.equal(getEntryLifecycle(entry("link", { rel: "preload", href: "/x.js" })), "sticky");
        assert.equal(
            getEntryLifecycle(
                entry("link", { rel: "stylesheet", href: "/app.css", precedence: "base" }),
            ),
            "sticky",
        );
        assert.equal(
            getEntryLifecycle(entry("style", { href: "inline:x", precedence: "base" })),
            "sticky",
        );
        assert.equal(getEntryLifecycle(entry("script", { src: "/app.js", async: true })), "sticky");
    });

    it("normalizes supported entries and drops unsupported entries", () => {
        assert.deepEqual(normalizeEntry(entry("meta", { name: "description", content: "Hello" })), {
            type: "meta",
            props: { name: "description", content: "Hello" },
            key: "meta:name:description",
            lifecycle: "replaceable",
        });

        assert.equal(normalizeEntry(entry("script", { src: "/sync.js" })), null);
    });
});
