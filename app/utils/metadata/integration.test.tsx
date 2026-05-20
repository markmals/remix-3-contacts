import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { type Handle, type RemixNode } from "remix/ui";
import { renderToString } from "remix/ui/server";

import { Head, createMetadataManager, injectMetadataIntoHtml } from "./index.ts";

function Layout(handle: Handle<{ children?: RemixNode }>) {
    return () => (
        <html>
            <head>
                <meta charset="utf-8" />
            </head>
            <body>{handle.props.children}</body>
        </html>
    );
}

function ChildPage() {
    return () => (
        <>
            <Head owner="child-page">
                <title>Child Page</title>
                <meta content="Child description" name="description" />
                <link href="/child" rel="canonical" />
            </Head>

            <main>Child page</main>
        </>
    );
}

function loadIntoDocument(html: string) {
    let parser = new DOMParser();
    let parsed = parser.parseFromString(html, "text/html");
    document.head.replaceChildren(...Array.from(parsed.head.childNodes));
    document.body.replaceChildren(...Array.from(parsed.body.childNodes));
}

async function nextMicrotask() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("metadata integration", () => {
    it("injects child metadata into SSR document head", async () => {
        let raw = await renderToString(
            <Layout>
                <ChildPage />
            </Layout>,
        );

        let html = injectMetadataIntoHtml(raw);

        assert.ok(html.includes('<meta charset="utf-8"'));
        assert.ok(html.includes("<title"));
        assert.ok(html.includes(">Child Page</title>"));
        assert.ok(html.includes('name="description"'));
        assert.ok(html.includes('href="/child"'));
        assert.ok(html.includes('data-pitlane-metadata-owner="child-page"'));
    });

    it("hydrates templates and removes replaceable metadata when the owner disappears", async () => {
        let raw = await renderToString(
            <Layout>
                <div id="frame">
                    <ChildPage />
                </div>
            </Layout>,
        );

        loadIntoDocument(raw);

        let manager = createMetadataManager();
        manager.hydrate(document);

        assert.equal(document.head.querySelector("title")?.textContent, "Child Page");

        document.getElementById("frame")?.remove();
        await nextMicrotask();

        assert.equal(document.head.querySelector("title"), null);

        manager.dispose();
    });
});
