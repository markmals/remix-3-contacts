import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component/jsx-runtime";
import { renderToStream } from "remix/component/server";
import { createHtmlResponse } from "remix/response/html";
import { router } from "~/router.ts";

export const render = {
    // Using createHtmlResponse inserts DOCTYPE at the beginning of the document
    // For frame partials, we don't want to include DOCTYPE
    frame(node: JSX.Element): Response {
        return new Response(renderToStream(node), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    },
    document(node: RemixNode): Response {
        return createHtmlResponse(
            renderToStream(node, {
                async resolveFrame(src) {
                    const ctx = getContext();
                    const url = new URL(src, ctx.url);
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
