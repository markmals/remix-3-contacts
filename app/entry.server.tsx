import { ZeroState } from "#/components/ZeroState.tsx";
import contacts from "#/contacts.tsx";
import { document, sidebar } from "#/lib/render.tsx";
import { createFrameResponse as frame, Frame, frameTarget } from "#/lib/util/frame.tsx";
import { loadFileStorage, loadDatabase } from "#/middleware.ts";
import { routes } from "#/routes.ts";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";

export let router = createRouter({
    middleware: [
        staticFiles("./public"),
        staticFiles("./dist/client"),
        formData(),
        methodOverride(),
        asyncContext(),
        loadDatabase(),
        loadFileStorage(),
        frameTarget(),
    ],
});

router.map(routes.home, async ctx => {
    if (ctx.get(Frame.Target).is("sidebar")) return sidebar();
    if (ctx.get(Frame.Target).is("detail")) return frame(<ZeroState />);
    return document();
});

router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
