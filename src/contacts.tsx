import type { Controller } from "remix/fetch-router";
import type { RemixNode } from "remix/component";
import { redirect } from "remix/response/redirect";
import { EditContact } from "~/components/EditContact.tsx";
import { ShowContact } from "~/components/ShowContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import {
    type Contact,
    createContact,
    deleteContact,
    getContact,
    updateContact,
} from "~/lib/database/contacts.ts";
import { documentWithSidebar, isDetailFrameRequest, render } from "~/lib/render.tsx";
import { routes } from "~/routes.ts";

async function contactPage(
    context: { params: { id?: string | number }; url: URL },
    detail: (contact: Contact) => RemixNode,
) {
    if (!context.params.id) {
        return redirect(routes.home.href());
    }

    if (isDetailFrameRequest()) {
        const contact = await getContact(Number(context.params.id));
        if (!contact) return render.frame(<ZeroState />);
        return render.frame(detail(contact));
    }

    return documentWithSidebar(context.params.id);
}

export default {
    actions: {
        show: context =>
            contactPage(context, contact => (
                <ShowContact contact={contact} query={context.url.searchParams.get("q")} />
            )),
        edit: context => contactPage(context, contact => <EditContact contact={contact} />),
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
