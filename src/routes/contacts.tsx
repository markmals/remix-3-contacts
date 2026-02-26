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

export const show: BuildAction<"GET", typeof routes.contacts.show> = async ({ params }) => {
    if (!params.id) {
        return redirect(routes.home.href());
    }

    const contact = await getContact(Number(params.id));

    if (!contact) {
        return redirect(routes.home.href());
    }

    return render.document(<Document />);
};

export default {
    show,
    edit: show,
    async create() {
        const id = await createContact();
        return redirect(routes.contacts.edit.href({ id }));
    },
    async destroy({ params }) {
        await deleteContact(Number(params.id));
        return redirect(routes.home.href());
    },
    async favorite({ params, formData }) {
        const update = await updateContact(Number(params.id), {
            favorite: formData.get("favorite") === "true",
        });
        return Response.json(update);
    },
    async update({ params, formData }) {
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
    },
} satisfies Controller<typeof routes.contacts>;
