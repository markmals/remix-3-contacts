import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

// `exports.default.fetch()` drives the Workers entry exactly as deployed —
// middleware stack, router, the lot — without the test having to hand-build a
// correctly-typed inbound `Request`.
function fetchApp(path: string, init?: RequestInit) {
    return exports.default.fetch(`https://contacts.test${path}`, init);
}

/** Asks the app to create a contact and returns the id it redirected to. */
async function createContact() {
    let response = await fetchApp("/contacts", { method: "POST", redirect: "manual" });
    let location = response.headers.get("location") ?? "";
    return Number(location.match(/\/contacts\/(\d+)\/edit/)?.[1]);
}

/** A form body shaped like the edit form's, including the method override. */
function editBody(fields: Record<string, string>) {
    let body = new FormData();
    body.set("_method", "PUT");
    for (let [name, value] of Object.entries(fields)) body.set(name, value);
    return body;
}

const DETAIL_FRAME = { "x-remix-frame": "true", "x-remix-target": "detail" };

beforeEach(async () => {
    await env.DB.prepare("delete from contacts").run();
});

describe("invalid input", () => {
    it("rejects a contact id that is not a number", async () => {
        // The route pattern matches any segment, so the schema is the only guard.
        expect((await fetchApp("/contacts/abc")).status).toBe(400);
    });

    it("rejects an id that is numeric but out of range", async () => {
        expect((await fetchApp("/contacts/-3")).status).toBe(400);
    });

    it("does not even match a route for an id with a decimal point", async () => {
        // `.` is not part of a path-segment match, so this never reaches the
        // schema — it is the router's own not-found, not the app's 400.
        expect((await fetchApp("/contacts/1.5")).status).toBe(404);
    });

    it("rejects an edit payload that fails validation", async () => {
        let id = await createContact();
        let response = await fetchApp(`/contacts/${id}`, {
            body: editBody({ avatar: "https://evil.example/x.png", first: "Ada" }),
            method: "POST",
        });

        expect(response.status).toBe(400);
    });
});

describe("missing contacts", () => {
    it("answers 404 rather than redirecting", async () => {
        expect((await fetchApp("/contacts/99999")).status).toBe(404);
    });

    it("renders the not-found page into the detail frame", async () => {
        let response = await fetchApp("/contacts/99999", { headers: DETAIL_FRAME });

        expect(response.status).toBe(404);
        expect(await response.text()).toContain("That contact does not exist");
    });

    it("still serves the sidebar, because the collection exists", async () => {
        let response = await fetchApp("/contacts/99999", {
            headers: { "x-remix-frame": "true", "x-remix-target": "sidebar" },
        });

        expect(response.status).toBe(200);
    });
});

describe("contact lifecycle", () => {
    it("creates, edits and deletes through the unenhanced form flow", async () => {
        let id = await createContact();
        expect(Number.isInteger(id)).toBe(true);

        let saved = await fetchApp(`/contacts/${id}`, {
            body: editBody({ bsky: "ada.bsky.social", first: "Ada", last: "Lovelace" }),
            method: "POST",
            redirect: "manual",
        });
        expect(saved.status).toBe(302);

        let page = await fetchApp(`/contacts/${id}`);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("Lovelace");

        let body = new FormData();
        body.set("_method", "DELETE");
        let deleted = await fetchApp(`/contacts/${id}`, {
            body,
            method: "POST",
            redirect: "manual",
        });
        expect(deleted.status).toBe(302);
        expect((await fetchApp(`/contacts/${id}`)).status).toBe(404);
    });

    it("toggles a favorite and answers each submission in its own shape", async () => {
        let id = await createContact();

        let body = new FormData();
        body.set("_method", "PATCH");
        body.set("favorite", "true");

        // Enhanced: the client reloads the frames itself, so there is no body.
        let enhanced = await fetchApp(`/contacts/${id}/favorite`, {
            body,
            headers: DETAIL_FRAME,
            method: "POST",
        });
        expect(enhanced.status).toBe(204);

        // Unenhanced: POST/Redirect/GET back to the contact.
        let plain = new FormData();
        plain.set("_method", "PATCH");
        plain.set("favorite", "false");
        let unenhanced = await fetchApp(`/contacts/${id}/favorite`, {
            body: plain,
            method: "POST",
            redirect: "manual",
        });
        expect(unenhanced.status).toBe(302);
        expect(unenhanced.headers.get("location")).toBe(`/contacts/${id}`);
    });
});

describe("frame targeting", () => {
    it("serves a whole document when no frame header is present", async () => {
        let response = await fetchApp("/");

        expect(response.status).toBe(200);
        expect(await response.text()).toContain("<!DOCTYPE html>");
    });

    it("ignores a target header that is not part of a frame request", async () => {
        // A stray X-Remix-Target must not downgrade a navigation to a fragment.
        let response = await fetchApp("/", { headers: { "x-remix-target": "detail" } });

        expect(await response.text()).toContain("<!DOCTYPE html>");
    });
});
