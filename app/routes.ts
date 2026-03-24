import { createRoutes, resources } from "remix/fetch-router/routes";

export const routes = createRoutes({
    home: "/",
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: { method: "PATCH", pattern: "/contacts/:id/favorite" },
    },
});
