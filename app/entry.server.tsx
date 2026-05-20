import contacts from "#/actions/contacts.tsx";
import controller, { uploadHandler } from "#/actions/controller.tsx";
import { database } from "#/middleware.ts";
import { routes } from "#/routes.ts";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type Middleware, type MiddlewareContext } from "remix/router";

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

let middleware = [
    rescueResponses(),
    staticFiles("./public"),
    staticFiles("./dist/client"),
    formData({ uploadHandler }),
    methodOverride(),
    asyncContext(),
    database(),
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
