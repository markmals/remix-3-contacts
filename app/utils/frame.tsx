import type { Middleware } from "remix/fetch-router";

import { createMixin, Frame as RemixFrame, type RemixNode } from "remix/component";
import { renderToStream } from "remix/component/server";
import * as s from "remix/data-schema";

export function Frame() {
    return (props: { name: Frame.Name; url: URL }) => (
        <RemixFrame name={props.name} src={props.url.toString()} />
    );
}

export namespace Frame {
    export const Name = s.literal("detail" as const);
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

export type LinkProps = { target?: Frame.Name; src?: URL; resetScroll?: boolean };

export let link = createMixin<HTMLAnchorElement | HTMLButtonElement, [LinkProps]>(handle => {
    return props => (
        <handle.element
            rmx-reset-scroll={props.resetScroll != null ? `${props.resetScroll}` : undefined}
            rmx-src={props.src?.toString()}
            rmx-target={props.target}
        />
    );
});

export function frameTarget(): Middleware {
    return (ctx, next) => {
        ctx.set(Frame.Target, new Frame.Target(ctx.headers));
        return next();
    };
}

export function createFrameResponse(node: RemixNode): Response {
    return new Response(renderToStream(node), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
