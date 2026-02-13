import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { deleteContact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export const destroy: BuildAction<"DELETE", typeof routes.contacts.destroy> = ({ formData }) => {
    const contactIdValue = formData.get("id");

    if (typeof contactIdValue === "string" && contactIdValue.length > 0) {
        deleteContact(contactIdValue);
    }

    return redirect(routes.home.href());
};
