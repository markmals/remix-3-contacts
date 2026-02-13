import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { buildEditHref } from "~/lib/contact-links.ts";
import { createContact } from "~/lib/database/contacts.ts";
import type { routes } from "~/routes.ts";

export const create: BuildAction<"POST", typeof routes.contacts.create> = () => {
    const contact = createContact();
    return redirect(buildEditHref(contact.id, null));
};
