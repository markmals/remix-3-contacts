import type { BuildAction } from "remix/fetch-router";
import { ShowContact } from "~/components/ShowContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { html } from "~/lib/responses/html.tsx";
import type { routes } from "~/routes.ts";

export const show: BuildAction<"ANY", typeof routes.frame.show> = async ({ request }) => {
    const url = new URL(request.url);
    const contactId = url.searchParams.get("id") ?? undefined;
    const query = url.searchParams.get("q");
    const contact = await getContact(contactId);

    if (!contact) {
        return html(<ZeroState />);
    }

    return html(<ShowContact setup={{ contact, query }} />);
};
