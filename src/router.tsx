import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";
import { staticFiles } from "remix/static-middleware";
import * as contacts from "./routes/contacts/index.ts";
import * as frame from "./routes/frames/index.ts";
import { home } from "./routes/home.tsx";
import { routes } from "./routes.ts";

export const router = createRouter({
    middleware: [staticFiles("./public"), formData(), methodOverride(), asyncContext()],
});

router.map(routes, {
    home,
    contacts,
    frame,
});
