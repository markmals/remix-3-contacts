import contacts from "#/actions/contacts.tsx";
import controller from "#/actions/controller.tsx";
import { database, uploadErrors } from "#/middleware.ts";
import { routes } from "#/routes.ts";
import { uploadHandler } from "#/utils/uploads.ts";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

let middleware = [
    uploadErrors(),
    staticFiles("./public"),
    staticFiles("./dist/client"),
    formData({ uploadHandler }),
    methodOverride(),
    asyncContext(),
    database(),
    render(),
] as const;

declare module "remix/router" {
    interface RouterTypes {
        context: MiddlewareContext<typeof middleware>;
    }
}

export let router = createRouter({ middleware });

router.map(routes, controller);
router.map(routes.contacts, contacts);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
