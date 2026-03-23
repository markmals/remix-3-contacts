import type { BuildAction, Controller } from "remix/fetch-router";
import { redirect } from "remix/response/redirect";
import { Document } from "~/components/Document.tsx";
import {
    type Contact,
    createContact,
    deleteContact,
    getContact,
    updateContact,
} from "~/lib/database/contacts.ts";
import { render } from "~/lib/render.tsx";
import { routes } from "~/routes.ts";

const contactPage: BuildAction<"GET", typeof routes.contacts.show> = async context => {
    if (!context.params.id) {
        return redirect(routes.home.href());
    }

    const contact = await getContact(Number(context.params.id));

    if (!contact) {
        return redirect(routes.home.href());
    }

    return render.document(<Document />);
};

export default {
    actions: {
        show: contactPage,
        edit: contactPage,
        async create() {
            const id = await createContact();
            return redirect(routes.contacts.edit.href({ id }));
        },
        async destroy(context) {
            await deleteContact(Number(context.params.id));
            return redirect(routes.home.href());
        },
        async favorite(context) {
            const formData = context.get(FormData);
            const update = await updateContact(Number(context.params.id), {
                favorite: formData.get("favorite") === "true",
            });
            return Response.json(update);
        },
        async update(context) {
            const contact = await getContact(Number(context.params.id));

            if (!contact) {
                return redirect(routes.home.href());
            }

            const formData = context.get(FormData);
            const updates: Partial<Contact> = {
                first: formData.get("first") as string,
                last: formData.get("last") as string,
                avatar: formData.get("avatar") as string,
                bsky: formData.get("bsky") as string,
                notes: formData.get("notes") as string,
            };

            await updateContact(Number(context.params.id), updates);

            return redirect(routes.contacts.show.href({ id: context.params.id }));
        },
    },
} satisfies Controller<typeof routes.contacts>;
