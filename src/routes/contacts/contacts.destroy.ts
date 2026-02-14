import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { deleteContact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export const destroy: BuildAction<"DELETE", typeof routes.contacts.destroy> = ({ params }) => {
    deleteContact(params.id);
    return redirect(routes.home.href());
};
