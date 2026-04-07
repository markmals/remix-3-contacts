import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";

import { ZeroState } from "~/components/ZeroState.tsx";

import contacts from "./contacts.tsx";
import { loadDatabase } from "./lib/database/middleware.ts";
import { document, isFrame, frame, sidebar } from "./lib/render.tsx";
import { routes } from "./routes.ts";

export let router = createRouter({
    middleware: [
        staticFiles("./public"),
        staticFiles("./dist/client"),
        formData(),
        methodOverride(),
        asyncContext(),
        loadDatabase(),
    ],
});

router.map(routes.home, async ctx => {
    if (isFrame(ctx, "sidebar")) return await sidebar();
    if (isFrame(ctx, "detail")) return frame(<ZeroState />);
    return document();
});

router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
