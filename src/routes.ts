import { createRoutes, resource, route } from "remix/fetch-router/routes";

export const routes = createRoutes({
    home: "/",
    contacts: resource("/contacts"),
    frame: route("/frame", {
        sidebar: "sidebar",
        index: "index",
        show: "show",
        edit: "edit",
    }),
});
