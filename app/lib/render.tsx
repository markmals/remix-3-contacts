import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";
import { SidebarItem } from "~/components/SidebarItem.tsx";
import { Document } from "~/components/Document.tsx";
import { router } from "~/entry.server.tsx";
import { getContacts } from "~/lib/database/contacts.ts";
import { QuerySchema } from "./schemas.ts";

function frameTarget(): string | null {
    return getContext().request.headers.get("x-remix-target");
}

export function isDetailRequest(): boolean {
    return frameTarget() === "detail";
}

export function isSidebarRequest(): boolean {
    return frameTarget() === "sidebar";
}

export async function sidebar(selected?: string | number): Promise<Response> {
    const { url } = getContext();
    const { q } = s.parse(QuerySchema, url.searchParams);
    const contacts = await getContacts(q);

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
    const context = getContext();
    return html(
        renderToStream(<Document />, {
            frameSrc: context.url,
            async resolveFrame(src, target, ctx) {
                const url = new URL(src, ctx?.currentFrameSrc ?? context.url);
                const headers = new Headers({ accept: "text/html" });
                if (target) headers.set("x-remix-target", target);
                const response = await router.fetch(new Request(url, { headers }));

                if (!response.ok) {
                    throw new Error(`Failed to resolve frame ${url.pathname}`);
                }

                return response.body ?? (await response.text());
            },
        }),
    );
}

export function frame(node: RemixNode): Response {
    return new Response(renderToStream(node), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
