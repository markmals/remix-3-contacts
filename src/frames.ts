import { createRouter, frame } from "~/lib/frame-router/core.ts";
import { routes } from "~/routes.ts";

export const frames = createRouter({
    sidebar: [
        frame(routes.home, ({}, url) =>
            routes.frame.sidebar.href(null, { q: url.searchParams.get("q") }),
        ),
        frame(routes.contacts.show, ({ id }, url) =>
            routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ),
        frame(routes.contacts.edit, ({ id }, url) =>
            routes.frame.sidebar.href(null, { selected: id, q: url.searchParams.get("q") }),
        ),
    ],
    detail: [
        frame(routes.home, () => routes.frame.zero.href()),
        frame(routes.contacts.show, ({ id }) => routes.frame.show.href({ id })),
        frame(routes.contacts.edit, ({ id }) => routes.frame.edit.href({ id })),
    ],
});
