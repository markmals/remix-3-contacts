import { ZeroState } from "#/components/ZeroState.tsx";
import contacts from "#/controllers/contacts.tsx";
import { loadConvex } from "#/middleware/convex.ts";
import { routes } from "#/routes.ts";
import { createFrameResponse as frame, Frame, frameTarget } from "#/utils/frame.tsx";
import { document } from "#/utils/render.tsx";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { staticFiles } from "remix/static-middleware";

export let router = createRouter({
    middleware: [
        staticFiles("./public"),
        staticFiles("./dist/client"),
        asyncContext(),
        loadConvex(),
        frameTarget(),
    ],
});

router.map(routes.home, async ctx => {
    if (ctx.get(Frame.Target).is("detail")) return frame(<ZeroState />);
    return document();
});

router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
