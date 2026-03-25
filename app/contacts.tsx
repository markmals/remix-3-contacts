import type { RemixNode } from "remix/component";
import type { Controller, RequestContext } from "remix/fetch-router";
import * as s from "remix/data-schema";
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
import { document, isDetailRequest, isSidebarRequest, frame, sidebar } from "~/lib/render.tsx";
import { routes } from "~/routes.ts";
import { FavoriteSchema, QuerySchema, UpdateSchema } from "./lib/schemas.ts";

async function contactPage(
    context: RequestContext<{ id: string }>,
    detail: (contact: Contact) => RemixNode,
) {
    if (!context.params.id) {
        return redirect(routes.home.href());
    }

    if (isSidebarRequest()) return await sidebar(context.params.id);

    if (isDetailRequest()) {
        let contact = await getContact(Number(context.params.id));
        if (!contact) return frame(<ZeroState />);
        return frame(detail(contact));
    }

    return document();
}

export default {
    actions: {
        async show(context) {
            let { q } = s.parse(QuerySchema, context.url.searchParams);
            return await contactPage(context, contact => (
                <ShowContact contact={contact} query={q} />
            ));
        },
        async edit(context) {
            return await contactPage(context, contact => <EditContact contact={contact} />);
        },
        async create() {
            let id = await createContact();
            return redirect(routes.contacts.edit.href({ id }));
        },
        async destroy(context) {
            await deleteContact(Number(context.params.id));
            return redirect(routes.home.href());
        },
        async favorite(context) {
            let { favorite } = s.parse(FavoriteSchema, context.get(FormData));
            let update = await updateContact(Number(context.params.id), {
                favorite,
            });
            return Response.json(update);
        },
        async update(context) {
            let contact = await getContact(Number(context.params.id));

            if (!contact) {
                return redirect(routes.home.href());
            }

            let updates = s.parse(UpdateSchema, context.get(FormData));
            await updateContact(Number(context.params.id), updates);

            return redirect(routes.contacts.show.href({ id: context.params.id }));
        },
    },
} satisfies Controller<typeof routes.contacts>;
