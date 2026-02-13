import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { Document } from "~/components/Document.tsx";
import { getContactId } from "~/lib/contact-params.ts";
import { getContact } from "~/lib/database/contacts.ts";
import { render } from "~/lib/responses/render.tsx";
import { routes } from "~/routes.ts";

export const show: BuildAction<"GET", typeof routes.contacts.show> = async ({ request }) => {
    const url = new URL(request.url);
    const contactId = getContactId(url);

    if (!contactId) {
        return redirect(routes.home.href());
    }

    const contact = await getContact(contactId);

    if (!contact) {
        return redirect(routes.home.href());
    }

    return render(<Document setup={{ url }} />);
};
