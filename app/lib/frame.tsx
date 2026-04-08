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

    // Preserve the href/role accessibility discriminant from the anchor type
    type AnchorElement = JSX.IntrinsicHTMLElements["a"];
    type AnchorBase = Omit<
        AnchorElement,
        "href" | "role" | "rmx-target" | "rmx-src" | "rmx-reset-scroll"
    >;
    type HrefRole = Extract<AnchorElement, { href: string }>["role"];
    type NoHrefRole = Exclude<AnchorElement, { href: string }>["role"];

    export type LinkProps = AnchorBase &
        (
            | {
                  "rmx:target"?: Name;
                  "rmx:src": URL;
                  href?: never;
                  role?: NoHrefRole;
                  "rmx:resetScroll"?: boolean;
              }
            | {
                  "rmx:target"?: Name;
                  "rmx:src"?: never;
                  href: string;
                  role?: HrefRole;
                  "rmx:resetScroll"?: boolean;
              }
        );

    export function Link() {
        return (props: LinkProps) => {
            let {
                "rmx:target": target,
                "rmx:src": src,
                "rmx:resetScroll": resetScroll,
                ...rest
            } = props;

            return (
                <a
                    {...rest}
                    rmx-reset-scroll={resetScroll != null ? `${resetScroll}` : undefined}
                    rmx-src={src?.toString()}
                    rmx-target={target}
                />
            );
        };
    }

    export type ButtonProps = JSX.IntrinsicHTMLElements["button"] & {
        "rmx:target"?: Name;
        "rmx:src"?: URL;
        "rmx:resetScroll"?: boolean;
    };

    export function Button() {
        return (props: ButtonProps) => {
            let {
                "rmx:target": target,
                "rmx:src": src,
                "rmx:resetScroll": resetScroll,
                ...rest
            } = props;

            return (
                <button
                    {...rest}
                    rmx-reset-scroll={resetScroll != null ? `${resetScroll}` : undefined}
                    rmx-src={src?.toString()}
                    rmx-target={target}
                />
            );
        };
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
