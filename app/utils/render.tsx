import { Document } from "#/components/Document.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
import { router } from "#/entry.server.tsx";
import styles from "#/index.css?url";
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import { getContext } from "remix/async-context-middleware";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";

export async function document(): Promise<Response> {
    let context = getContext();
    let { q } = s.parse(QuerySchema, context.url.searchParams);
    let contacts = await getContacts(q);
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return html(
        renderToStream(
            <Document
                clientScript={clientAssets.entry ?? ""}
                contacts={contacts}
                css={css}
                js={js}
                query={q}
                styles={styles}
                url={context.url.toString()}
            />,
            {
                frameSrc: context.url,
                async resolveFrame(src, target, ctx) {
                    let url = new URL(src, ctx?.currentFrameSrc ?? context.url);
                    let headers = new Headers({ accept: "text/html" });
                    if (target) headers.set("x-remix-target", target);
                    let response = await router.fetch(new Request(url, { headers }));

                    if (!response.ok) {
                        throw new Error(`Failed to resolve frame ${url.pathname}`);
                    }

                    return response.body ?? (await response.text());
                },
            },
        ),
    );
}
