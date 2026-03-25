import { route, resources } from "remix/fetch-router/routes";

export let routes = route({
    home: "/",
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: { method: "PATCH", pattern: "/contacts/:id/favorite" },
    },
});
