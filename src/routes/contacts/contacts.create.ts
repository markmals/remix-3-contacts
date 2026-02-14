import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { createContact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export const create: BuildAction<"POST", typeof routes.contacts.create> = async () => {
    const id = await createContact();
    return redirect(routes.contacts.edit.href({ id }));
};
