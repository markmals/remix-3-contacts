import { renderToStream } from "remix/component/server";

export function html(node: JSX.Element): Response {
    return new Response(renderToStream(node), {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}
