import type { BuildAction } from "remix/fetch-router";
import { EditContact } from "~/components/EditContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { html } from "~/lib/responses/html.tsx";
import type { routes } from "~/routes.ts";

export const edit: BuildAction<"ANY", typeof routes.frame.edit> = async ({ params }) => {
    const contact = await getContact(params.id);

    if (!contact) {
        return html(<ZeroState />);
    }

    return html(<EditContact contact={contact} />);
};
