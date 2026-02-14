import type { BuildAction } from "remix/fetch-router";
import { updateContact } from "~/lib/database/contacts.ts";
import type { routes } from "~/routes.ts";

export const favorite: BuildAction<"PATCH", typeof routes.contacts.favorite> = async ({
    formData,
    params,
}) => {
    const update = await updateContact(params.id, {
        favorite: formData.get("favorite") === "true",
    });
    return Response.json(update);
};
