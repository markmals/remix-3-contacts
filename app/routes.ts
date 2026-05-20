import { get, patch, resources, route } from "remix/routes";

export let routes = route({
    home: get("/"),
    uploads: get("/uploads/*key"),
    contacts: {
        ...resources("/contacts", { exclude: ["index", "new"] }),
        favorite: patch("/contacts/:id/favorite"),
    },
});
