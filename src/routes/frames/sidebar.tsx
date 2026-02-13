import type { BuildAction } from "remix/fetch-router";
import { Sidebar } from "~/components/Sidebar.tsx";
import { getContacts } from "~/lib/database/contacts.ts";
import { html } from "~/lib/responses/html.tsx";
import { routes } from "~/routes.ts";

export const sidebar: BuildAction<"ANY", typeof routes.frame.sidebar> = async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const selectedId = url.searchParams.get("id");
    const activePath = url.searchParams.get("path") ?? routes.home.href();
    const contacts = await getContacts(query);

    return html(
        <Sidebar
            setup={{
                activePath,
                contacts,
                query,
                selectedId,
            }}
        />,
    );
};
