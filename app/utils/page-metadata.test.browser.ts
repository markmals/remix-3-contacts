import { applyPageMetadata, pageMetadataHeaders } from "#/utils/page-metadata.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

function apply(metadata: Parameters<typeof pageMetadataHeaders>[0]): void {
    applyPageMetadata(new Headers(pageMetadataHeaders(metadata)));
}

function description(): string | null {
    return (
        document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? null
    );
}

describe("page metadata", () => {
    it("round-trips a non-ASCII title through an ASCII-only header", () => {
        apply({ title: "Ada Lovelace · Remix 3 Contacts" });
        assert.equal(document.title, "Ada Lovelace · Remix 3 Contacts");
    });

    it("upserts the description rather than duplicating it", () => {
        apply({ description: "first", title: "one" });
        apply({ description: "second", title: "two" });

        assert.equal(document.head.querySelectorAll('meta[name="description"]').length, 1);
        assert.equal(description(), "second");
    });

    it("drops a stale description when the next page has none", () => {
        apply({ description: "present", title: "one" });
        apply({ title: "two" });

        assert.equal(description(), null);
    });

    it("leaves the document alone when a response carries no metadata", () => {
        apply({ title: "kept" });
        applyPageMetadata(new Headers());

        assert.equal(document.title, "kept");
    });
});
