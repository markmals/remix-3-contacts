import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { getContact, updateContact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export const update: BuildAction<"PUT", typeof routes.contacts.update> = async ({
    formData,
    params,
}) => {
    const contact = await getContact(params.id);

    if (!contact) {
        return redirect(routes.home.href());
    }

    const updates: Record<string, string | boolean> = {};

    const first = formData.get("first");
    const last = formData.get("last");
    const avatar = formData.get("avatar");
    const bsky = formData.get("bsky");
    const notes = formData.get("notes");
    const favorite = formData.get("favorite");

    if (typeof first === "string") updates.first = first;
    if (typeof last === "string") updates.last = last;
    if (typeof avatar === "string") updates.avatar = avatar;
    if (typeof bsky === "string") updates.bsky = bsky;
    if (typeof notes === "string") updates.notes = notes;
    if (typeof favorite === "string") updates.favorite = favorite === "true";

    await updateContact(params.id, updates);

    return redirect(routes.contacts.show.href({ id: params.id }));
};
