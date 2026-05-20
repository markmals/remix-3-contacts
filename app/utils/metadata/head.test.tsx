import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { type RemixElement } from "remix/ui";
import { renderToString } from "remix/ui/server";

import { Head, entriesFromHeadChildren } from "./head.tsx";
import { extractTransportTemplates } from "./transport.ts";

async function render(node: RemixElement): Promise<string> {
    return await renderToString(node);
}

describe("<Head>", () => {
    it("extracts lowercase metadata children", () => {
        let entries = entriesFromHeadChildren([
            <title>Page</title>,
            <meta content="Description" name="description" />,
            <link href="/page" rel="canonical" />,
        ]);

        assert.deepEqual(entries, [
            { type: "title", props: {}, children: "Page", order: 0 },
            { type: "meta", props: { name: "description", content: "Description" }, order: 1 },
            { type: "link", props: { rel: "canonical", href: "/page" }, order: 2 },
        ]);
    });

    it("renders a transport template", async () => {
        let html = await render(
            <html>
                <head />
                <body>
                    <Head owner="page">
                        <title>Page</title>
                        <meta content="Description" name="description" />
                        <link href="/page" rel="canonical" />
                    </Head>
                </body>
            </html>,
        );

        assert.deepEqual(extractTransportTemplates(html), [
            {
                owner: "page",
                entries: [
                    { type: "title", props: {}, children: "Page", order: 0 },
                    {
                        type: "meta",
                        props: { name: "description", content: "Description" },
                        order: 1,
                    },
                    { type: "link", props: { rel: "canonical", href: "/page" }, order: 2 },
                ],
            },
        ]);
    });
});
