import { ConvexHttpClient } from "convex/browser";
import { type Middleware } from "remix/fetch-router";

export function loadConvex(): Middleware {
    let client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

    return (ctx, next) => {
        ctx.set(ConvexHttpClient, client);
        return next();
    };
}
