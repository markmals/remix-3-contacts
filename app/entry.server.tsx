import { Document } from "#/components/Document.tsx";
import { ZeroState } from "#/components/ZeroState.tsx";
import contacts from "#/controllers/contacts.tsx";
import { sidebar } from "#/controllers/sidebar.tsx";
import { serveUpload, uploadHandler } from "#/controllers/uploads.ts";
import { database } from "#/middleware.ts";
import { routes } from "#/routes.ts";
import { frame, render } from "#/utils/render.tsx";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter, type Middleware } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { createHtmlResponse as html } from "remix/response/html";
import { staticFiles } from "remix/static-middleware";

function rescueResponses(): Middleware {
    return async (ctx, next) => {
        try {
            return await next();
        } catch (error) {
            if (error instanceof Response) return error;
            throw error;
        }
    };
}

export let router = createRouter({
    middleware: [
        rescueResponses(),
        staticFiles("./public"),
        staticFiles("./dist/client"),
        formData({ uploadHandler }),
        methodOverride(),
        asyncContext(),
        database(),
    ],
});

router.map(routes.uploads, serveUpload);

router.map(routes.home, async ctx => {
    if (ctx.headers.get("x-remix-target") === "sidebar") return sidebar();
    if (ctx.headers.get("x-remix-target") === "detail") return frame(render(<ZeroState />));
    return html(render(<Document />));
});

router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
