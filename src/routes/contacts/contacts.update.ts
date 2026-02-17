import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { type Contact, getContact, updateContact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export const update: BuildAction<"PUT", typeof routes.contacts.update> = async ({
    formData,
    params,
}) => {
    const contact = await getContact(Number(params.id));

    if (!contact) {
        return redirect(routes.home.href());
    }

    const updates: Partial<Contact> = {
        first: formData.get("first") as string,
        last: formData.get("last") as string,
        avatar: formData.get("avatar") as string,
        bsky: formData.get("bsky") as string,
        notes: formData.get("notes") as string,
        favorite: formData.get("favorite") === "true",
    };

    await updateContact(Number(params.id), updates);

    return redirect(routes.contacts.show.href({ id: params.id }));
};
