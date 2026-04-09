import { get, route } from "remix/fetch-router/routes";

export let routes = route({
    home: get("/"),
    contacts: {
        show: get("/contacts/:id"),
        edit: get("/contacts/:id/edit"),
    },
});
