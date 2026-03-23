import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component/jsx-runtime";
import { renderToStream } from "remix/component/server";
import { createHtmlResponse } from "remix/response/html";
import { router } from "~/router.tsx";

export const render = {
    // Using createHtmlResponse inserts DOCTYPE at the beginning of the document
    // For frame partials, we don't want to include DOCTYPE
    frame(node: JSX.Element): Response {
        return new Response(renderToStream(node), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    },
    document(node: RemixNode): Response {
        const ctx = getContext();
        return createHtmlResponse(
            renderToStream(node, {
                frameSrc: ctx.url,
                async resolveFrame(src, _target, context) {
                    const url = new URL(src, context?.currentFrameSrc ?? ctx.url);
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
