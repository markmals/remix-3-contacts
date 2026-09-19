import { UpdateSchema } from "#/data/schemas.ts";
import * as assert from "remix/assert";
import * as s from "remix/data-schema";
import { describe, it } from "remix/test";

function submit(fields: Record<string, string>) {
    let formData = new FormData();
    for (let [name, value] of Object.entries(fields)) formData.set(name, value);
    return s.parseSafe(UpdateSchema, formData);
}

const CONTACT = { bsky: "ada.bsky.social", first: "Ada", last: "Lovelace", notes: "hi" };

describe("UpdateSchema", () => {
    it("accepts a wholly blank submission", () => {
        // `create` makes an empty contact, so the edit form's first save is this.
        assert.equal(submit({ bsky: "", first: "", last: "", notes: "" }).success, true);
    });

    it("accepts an omitted avatar, which is what an empty file input produces", () => {
        // `uploadHandler` returns undefined for an empty part, and the parser
        // drops the field rather than appending it.
        assert.equal(submit(CONTACT).success, true);
    });

    it("accepts the upload path the server itself generated", () => {
        let result = submit({ ...CONTACT, avatar: "/uploads/avatar/1712345678901-abc.jpg" });
        assert.equal(result.success, true);
    });

    it("rejects an avatar pointing anywhere but this app's uploads", () => {
        assert.equal(submit({ ...CONTACT, avatar: "https://evil.example/x.png" }).success, false);
        assert.equal(submit({ ...CONTACT, avatar: "//evil.example/x.png" }).success, false);
        assert.equal(submit({ ...CONTACT, avatar: "/uploads/../../etc/passwd" }).success, false);
    });

    it("accepts a Bluesky handle with the @ people paste", () => {
        assert.equal(submit({ ...CONTACT, bsky: "@markdalgleish.com" }).success, true);
    });

    it("rejects something that is not a handle", () => {
        assert.equal(submit({ ...CONTACT, bsky: "not a handle" }).success, false);
        assert.equal(submit({ ...CONTACT, bsky: "ada" }).success, false);
    });

    it("bounds the free-text fields", () => {
        assert.equal(submit({ ...CONTACT, first: "a".repeat(101) }).success, false);
        assert.equal(submit({ ...CONTACT, notes: "x".repeat(10_001) }).success, false);
    });
});
