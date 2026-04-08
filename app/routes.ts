import { route, resources, get, patch } from "remix/fetch-router/routes";

export let routes = route({
    home: get("/"),
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: patch("/contacts/:id/favorite"),
    },
});
