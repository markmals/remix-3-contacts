import { matchSorter } from "match-sorter";
import type { BuildAction } from "remix/fetch-router";
import { Sidebar } from "~/components/Sidebar.tsx";
import { getContacts } from "~/lib/database/contacts.ts";
import { renderFrame } from "~/lib/render.tsx";
import type { routes } from "~/routes.ts";

export const sidebar: BuildAction<"ANY", typeof routes.frame.sidebar> = async ({ url }) => {
    const query = url.searchParams.get("q");
    const selected = url.searchParams.get("selected");
    let contacts = await getContacts(query);

    if (query) {
        contacts = matchSorter(contacts, query, {
            keys: ["first", "last"],
        });
    }

    return renderFrame(<Sidebar contacts={contacts} query={query} selected={selected} />);
};
