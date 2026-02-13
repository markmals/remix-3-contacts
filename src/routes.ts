import { createRoutes, resource, route } from "remix/fetch-router/routes";

export const routes = createRoutes({
    home: "/",
    contacts: resource("/contacts"),
    frame: route("/_frame", {
        sidebar: "sidebar",
        zero: "zero",
        show: "show",
        edit: "edit",
    }),
});
