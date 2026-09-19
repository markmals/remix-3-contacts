import { ALLOWED_TYPES, imageExtension } from "#/utils/image-types.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

const SAMPLES: Record<string, string> = {
    "image/avif": "photo.avif",
    "image/gif": "photo.gif",
    "image/jpeg": "photo.jpg",
    "image/png": "photo.png",
    "image/svg+xml": "photo.svg",
    "image/webp": "photo.webp",
};

describe("imageExtension", () => {
    it("accepts every type the file input advertises", () => {
        // Whatever `accept` offers must be storable, or the picker lies.
        for (let type of ALLOWED_TYPES) {
            assert.notEqual(imageExtension(SAMPLES[type], type), undefined);
        }
    });

    it("normalises the extension rather than echoing the filename's", () => {
        assert.equal(imageExtension("photo.jpeg", "image/jpeg"), "jpg");
        assert.equal(imageExtension("PHOTO.JPG", "image/jpeg"), "jpg");
    });

    it("rejects a file whose declared type disagrees with its extension", () => {
        // The stored-XSS shape: an SVG dressed up as a PNG, or the reverse.
        assert.equal(imageExtension("evil.svg", "image/png"), undefined);
        assert.equal(imageExtension("evil.png", "image/svg+xml"), undefined);
    });

    it("rejects types outside the allowlist even when they agree", () => {
        assert.equal(imageExtension("doc.pdf", "application/pdf"), undefined);
        assert.equal(imageExtension("page.html", "text/html"), undefined);
    });

    it("rejects a filename that would smuggle a path segment into the key", () => {
        assert.equal(imageExtension("evil.j/pg", "image/jpeg"), undefined);
    });

    it("rejects a file with no usable extension", () => {
        assert.equal(imageExtension("photo", "image/jpeg"), undefined);
        assert.equal(imageExtension("", "image/jpeg"), undefined);
    });
});
