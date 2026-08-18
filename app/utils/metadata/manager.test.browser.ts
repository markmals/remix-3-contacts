import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MetadataManager } from "./manager.ts";
import { createTransportHtml } from "./transport.ts";

function replaceContents(parent: Element, html: string) {
    let range = document.createRange();
    range.selectNodeContents(parent);
    range.deleteContents();
    parent.appendChild(range.createContextualFragment(html));
}

function setDocument(html: string) {
    let parser = new DOMParser();
    let parsed = parser.parseFromString(`<!DOCTYPE html><html>${html}</html>`, "text/html");
    document.head.replaceChildren(...Array.from(parsed.head.childNodes));
    document.body.replaceChildren(...Array.from(parsed.body.childNodes));
}

async function nextMicrotask() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("MetadataManager", () => {
    it("hydrates templates into document.head", () => {
        setDocument(
            `<head></head><body>${createTransportHtml({
                owner: "page",
                entries: [
                    { type: "title", props: {}, children: "Page" },
                    { type: "meta", props: { name: "description", content: "Description" } },
                ],
            })}</body>`,
        );

        let manager = new MetadataManager();
        manager.hydrate(document);

        assert.equal(document.head.querySelector("title")?.textContent, "Page");
        assert.equal(
            document.head.querySelector('meta[name="description"]')?.getAttribute("content"),
            "Description",
        );

        manager.dispose();
    });

    it("removes replaceable entries when an owner disappears", async () => {
        setDocument(
            `<head></head><body><div id="frame">${createTransportHtml({
                owner: "frame",
                entries: [{ type: "meta", props: { name: "description", content: "Frame" } }],
            })}</div></body>`,
        );

        let manager = new MetadataManager();
        manager.hydrate(document);

        assert.notEqual(document.head.querySelector('meta[name="description"]'), null);

        document.getElementById("frame")?.remove();
        await nextMicrotask();

        assert.equal(document.head.querySelector('meta[name="description"]'), null);

        manager.dispose();
    });

    it("keeps sticky resources when an owner disappears", async () => {
        setDocument(
            `<head></head><body><div id="frame">${createTransportHtml({
                owner: "frame",
                entries: [
                    { type: "script", props: { src: "/app.js", async: true } },
                    {
                        type: "link",
                        props: { rel: "stylesheet", href: "/app.css", precedence: "base" },
                    },
                ],
            })}</div></body>`,
        );

        let manager = new MetadataManager();
        manager.hydrate(document);

        document.getElementById("frame")?.remove();
        await nextMicrotask();

        assert.notEqual(document.head.querySelector('script[src="/app.js"]'), null);
        assert.notEqual(document.head.querySelector('link[href="/app.css"]'), null);

        manager.dispose();
    });

    it("updates replaceable entries when a template changes", async () => {
        setDocument(
            `<head></head><body><div id="root">${createTransportHtml({
                owner: "page",
                entries: [{ type: "title", props: {}, children: "Old" }],
            })}</div></body>`,
        );

        let manager = new MetadataManager();
        manager.hydrate(document);

        let root = document.getElementById("root");
        if (root) {
            replaceContents(
                root,
                createTransportHtml({
                    owner: "page",
                    entries: [{ type: "title", props: {}, children: "New" }],
                }),
            );
        }

        await nextMicrotask();

        assert.equal(document.head.querySelector("title")?.textContent, "New");

        manager.dispose();
    });
});
