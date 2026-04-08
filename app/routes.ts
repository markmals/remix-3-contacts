import { route, resources, get, patch } from "remix/fetch-router/routes";

export let routes = route({
    home: get("/"),
    uploads: get("/uploads/*key"),
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: patch("/contacts/:id/favorite"),
    },
});
