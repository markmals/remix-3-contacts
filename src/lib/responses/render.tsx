import { getContext } from "remix/async-context-middleware";
import type { RemixNode } from "remix/component/jsx-runtime";
import { renderToStream } from "remix/component/server";
import { createHtmlResponse as html } from "remix/response/html";
import { router } from "~/router.tsx";

export async function render(node: RemixNode): Promise<Response> {
    const ctx = getContext();

    return html(
        renderToStream(node, {
            async resolveFrame(src) {
                const location = new URL(src, ctx.request.url);
                const frame = await router.fetch(
                    new Request(location, { headers: { accept: "text/html" } }),
                );

                if (!frame.ok) {
                    throw new Error(`Failed to resolve frame ${location.pathname}`);
                }

                if (frame.body) {
                    return frame.body;
                }

                return await frame.text();
            },
        }),
    );
}
