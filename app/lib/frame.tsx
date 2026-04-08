import type { Middleware } from "remix/fetch-router";

import { Frame as RemixFrame, type RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";

export function Frame() {
    return (props: { name: Frame.Name; url: URL }) => (
        <RemixFrame name={props.name} src={props.url.toString()} />
    );
}

export namespace Frame {
    export type Name = "detail" | "sidebar";

    export class Target {
        #name: string | null;

        constructor(headers: Headers) {
            this.#name = headers.get("x-remix-target");
        }

        is(name: Frame.Name): boolean {
            return this.#name === name;
        }
    }
}

export function frameRequest(): Middleware {
    return (ctx, next) => {
        ctx.set(Frame.Target, new Frame.Target(ctx.headers));
        return next();
    };
}

export function frame(node: RemixNode): Response {
    return new Response(renderToStream(node), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
