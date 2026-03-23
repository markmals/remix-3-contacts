import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";
import { ZeroState } from "~/components/ZeroState.tsx";
import { loadDatabase } from "./lib/database/middleware.ts";
import {
    documentResponse,
    isDetailFrameRequest,
    isSidebarFrameRequest,
    render,
    sidebarResponse,
} from "./lib/render.tsx";
import contacts from "./contacts.tsx";
import { routes } from "./routes.ts";

export const router = createRouter({
    middleware: [
        staticFiles("./public"),
        formData(),
        methodOverride(),
        asyncContext(),
        await loadDatabase(),
    ],
});

router.map(routes.home, async () => {
    if (isSidebarFrameRequest()) return sidebarResponse();
    if (isDetailFrameRequest()) return render.frame(<ZeroState />);
    return documentResponse();
});
router.map(routes.contacts, contacts);
