import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import { createHtmlResponse as html } from "remix/response/html";
import { matchSorter } from "match-sorter";
import { SidebarItem } from "~/assets/SidebarItem.tsx";
import { Document } from "~/components/Document.tsx";
import { getContacts } from "~/lib/database/contacts.ts";
import { router } from "~/router.tsx";

function frameTarget(): string | null {
    return getContext().request.headers.get("x-remix-target");
}

export function isDetailFrameRequest(): boolean {
    return frameTarget() === "detail";
}

export function isSidebarFrameRequest(): boolean {
    return frameTarget() === "sidebar";
}

export async function sidebarResponse(selected?: string | number) {
    const { url } = getContext();
    const query = url.searchParams.get("q");
    let contacts = await getContacts(query);
    if (query) {
        contacts = matchSorter(contacts, query, { keys: ["first", "last"] });
    }
    return render.frame(
        <nav>
            {contacts.length ? (
                <ul>
                    {contacts.map(contact => (
                        <SidebarItem
                            contact={contact}
                            query={query}
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

export function documentResponse() {
    return render.document(<Document />);
}

export const render = {
    frame(node: RemixNode): Response {
        return new Response(renderToStream(node), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    },
    document(node: RemixNode): Response {
        const context = getContext();
        return html(
            renderToStream(node, {
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
    },
};
