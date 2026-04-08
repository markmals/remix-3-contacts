import { Document } from "#/components/Document.tsx";
import { SidebarItem } from "#/components/SidebarItem.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import { router } from "#/entry.server.tsx";
import { createFrameResponse as frame } from "#/utils/frame.tsx";
import { getContext } from "remix/async-context-middleware";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";

export async function sidebar(selected?: string | number): Promise<Response> {
    let { url } = getContext();
    let { q } = s.parse(QuerySchema, url.searchParams);
    let contacts = await getContacts(q);

    return frame(
        <nav>
            {contacts.length ? (
                <ul>
                    {contacts.map(contact => (
                        <SidebarItem
                            contact={contact}
                            query={q}
                            selected={String(selected ?? "")}
                        />
                    ))}
                </ul>
            ) : (
                <p>
                    <i>No contacts</i>
                </p>
            )}
        </nav>,
    );
}

export function document(): Response {
    let context = getContext();
    return html(
        renderToStream(<Document />, {
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
