import { Document } from "#/components/Document.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import { router } from "#/entry.server.tsx";
import { getContext } from "remix/async-context-middleware";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";

export async function document(): Promise<Response> {
    let context = getContext();
    let { q } = s.parse(QuerySchema, context.url.searchParams);
    let contacts = await getContacts(q);

    return html(
        renderToStream(<Document contacts={contacts} query={q} />, {
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
        }),
    );
}
