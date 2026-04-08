import type { Middleware } from "remix/fetch-router";

import { Frame as RemixFrame, type RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";

export function Frame() {
    return (props: { name: Frame.Name; url: URL }) => (
        <RemixFrame name={props.name} src={props.url.toString()} />
    );
}

export namespace Frame {
    export let Name = s.union([s.literal("detail" as const), s.literal("sidebar" as const)]);
    export type Name = s.InferOutput<typeof Name>;

    export class Target {
        #name: string | null;

        constructor(headers: Headers) {
            this.#name = headers.get("x-remix-target");
        }

        is(name: Frame.Name): boolean {
            return this.#name === name;
        }

        get exists() {
            let { success } = s.parseSafe(Frame.Name, this.#name);
            return success;
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
