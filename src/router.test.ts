import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

process.env.NODE_ENV = "test";

const { router } = await import("~/router.tsx");
const { getContact } = await import("~/lib/database/contacts.ts");

const HTML_PATTERN = /<html/i;
const ENTRY_PATTERN = /\/assets\/entry\.js/;
const SIDEBAR_FRAME_PATTERN = /_frame\/sidebar/;
const INDEX_FRAME_PATTERN = /_frame\/index/;
const CREATE_REDIRECT_PATTERN = /^\/contacts\/edit\?id=\d+$/;
const SHOW_FRAME_PATTERN = /_frame\/show\?id=/;
const EDIT_FRAME_PATTERN = /_frame\/edit\?id=/;
const KENT_PATTERN = /Kent/;
const BROOKS_PATTERN = /Brooks/;
const DETAIL_ID_PATTERN = /id="detail"/;

function getLocation(response: Response): string {
    const location = response.headers.get("Location");

    if (!location) {
        throw new Error("Expected redirect Location header");
    }

    return location;
}

function getSearchParam(location: string, name: string): string {
    const url = new URL(location, "https://example.test");
    const value = url.searchParams.get(name);

    if (!value) {
        throw new Error(`Expected ${name} in ${location}`);
    }

    return value;
}

describe("router", () => {
    it("GET / returns HTML with frame mounts and hydration script", async () => {
        const response = await router.fetch("https://example.test/");
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(body, HTML_PATTERN);
        assert.match(body, ENTRY_PATTERN);
        assert.match(body, SIDEBAR_FRAME_PATTERN);
        assert.match(body, INDEX_FRAME_PATTERN);
    });

    it("create redirects to edit URL", async () => {
        const response = await router.fetch("https://example.test/contacts", {
            method: "POST",
        });

        assert.equal(response.status, 302);
        const location = getLocation(response);
        assert.match(location, CREATE_REDIRECT_PATTERN);
    });

    it("GET /contacts and /contacts/edit render with selected contact", async () => {
        const createResponse = await router.fetch("https://example.test/contacts", {
            method: "POST",
        });
        const editLocation = getLocation(createResponse);
        const contactId = getSearchParam(editLocation, "id");

        const showResponse = await router.fetch(
            `https://example.test/contacts?id=${encodeURIComponent(contactId)}`,
        );
        const showBody = await showResponse.text();

        assert.equal(showResponse.status, 200);
        assert.match(showBody, SHOW_FRAME_PATTERN);

        const editResponse = await router.fetch(
            `https://example.test/contacts/edit?id=${encodeURIComponent(contactId)}`,
        );
        const editBody = await editResponse.text();

        assert.equal(editResponse.status, 200);
        assert.match(editBody, EDIT_FRAME_PATTERN);
    });

    it("update via _method=PUT works and redirects to show", async () => {
        const createResponse = await router.fetch("https://example.test/contacts", {
            method: "POST",
        });
        const editLocation = getLocation(createResponse);
        const contactId = getSearchParam(editLocation, "id");

        const formData = new FormData();
        formData.set("_method", "PUT");
        formData.set("id", contactId);
        formData.set("first", "Updated");
        formData.set("last", "Contact");

        const updateResponse = await router.fetch("https://example.test/contacts", {
            body: formData,
            method: "POST",
        });

        assert.equal(updateResponse.status, 302);
        assert.equal(getLocation(updateResponse), `/contacts?id=${contactId}`);

        const contact = await getContact(contactId);
        assert.equal(contact?.first, "Updated");
        assert.equal(contact?.last, "Contact");
    });

    it("destroy via _method=DELETE removes and redirects home", async () => {
        const createResponse = await router.fetch("https://example.test/contacts", {
            method: "POST",
        });
        const editLocation = getLocation(createResponse);
        const contactId = getSearchParam(editLocation, "id");

        const formData = new FormData();
        formData.set("_method", "DELETE");
        formData.set("id", contactId);

        const destroyResponse = await router.fetch("https://example.test/contacts", {
            body: formData,
            method: "POST",
        });

        assert.equal(destroyResponse.status, 302);
        assert.equal(getLocation(destroyResponse), "/");
        assert.equal(await getContact(contactId), null);
    });

    it("search q filters sidebar frame", async () => {
        const response = await router.fetch("https://example.test/_frame/sidebar?q=kent");
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.match(body, KENT_PATTERN);
        assert.doesNotMatch(body, BROOKS_PATTERN);
    });

    it("missing contact document routes redirect home", async () => {
        const showResponse = await router.fetch("https://example.test/contacts?id=999999");
        const editResponse = await router.fetch("https://example.test/contacts/edit?id=999999");

        assert.equal(showResponse.status, 302);
        assert.equal(getLocation(showResponse), "/");
        assert.equal(editResponse.status, 302);
        assert.equal(getLocation(editResponse), "/");
    });

    it("frame endpoints return partial HTML", async () => {
        const response = await router.fetch("https://example.test/_frame/index");
        const body = await response.text();

        assert.equal(response.status, 200);
        assert.doesNotMatch(body, HTML_PATTERN);
        assert.match(body, DETAIL_ID_PATTERN);
    });
});
