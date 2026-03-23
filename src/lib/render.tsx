import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import { createHtmlResponse as html } from "remix/response/html";
import { router } from "~/router.tsx";

export const render = {
    // Using createHtmlResponse inserts DOCTYPE at the beginning of the document
    // For frame partials, we don't want to include DOCTYPE
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
                async resolveFrame(src, _target, ctx) {
                    const url = new URL(src, ctx?.currentFrameSrc ?? context.url);
                    const response = await router.fetch(
                        new Request(url, { headers: { accept: "text/html" } }),
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to resolve frame ${url.pathname}`);
                    }

                    if (response.body) {
                        return response.body;
                    }

                    return await response.text();
                },
            }),
        );
    },
};
