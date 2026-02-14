import { createRoutes, resources, route } from "remix/fetch-router/routes";

export const routes = createRoutes({
    home: "/",
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: { method: "PATCH", pattern: "/contacts/:id/favorite" },
    },
    frame: route("/_frame", {
        sidebar: "sidebar",
        zero: "zero",
        show: ":id/show",
        edit: ":id/edit",
    }),
});
