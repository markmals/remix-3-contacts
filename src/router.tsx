import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";
import { Document } from "~/components/Document.tsx";
import { loadDatabase } from "./lib/database/middleware.ts";
import { render } from "./lib/render.tsx";
import contacts from "./routes/contacts.tsx";
import frame from "./routes/frames.tsx";
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

router.map(routes.home, () => render.document(<Document />));
router.map(routes.contacts, contacts);
router.map(routes.frame, frame);
