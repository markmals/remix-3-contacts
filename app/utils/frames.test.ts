import { frameTarget } from "#/utils/frames.ts";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

describe("frameTarget", () => {
    it("reads the target of a frame request", () => {
        let headers = new Headers({ "x-remix-frame": "true", "x-remix-target": "detail" });
        assert.equal(frameTarget(headers), "detail");
    });

    it("ignores a target without the frame header so a navigation cannot be served a fragment", () => {
        let headers = new Headers({ "x-remix-target": "detail" });
        assert.equal(frameTarget(headers), null);
    });

    it("returns null for a frame request with no target", () => {
        let headers = new Headers({ "x-remix-frame": "true" });
        assert.equal(frameTarget(headers), null);
    });
});
