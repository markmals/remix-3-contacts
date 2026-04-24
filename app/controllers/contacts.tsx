import type { RemixNode } from "remix/component";
import type { Controller } from "remix/fetch-router";

import { Document } from "#/components/Document.tsx";
import { EditContact } from "#/components/EditContact.tsx";
import { ShowContact } from "#/components/ShowContact.tsx";
import {
    type Contact,
    createContact,
    deleteContact,
    getContact,
    updateContact,
} from "#/data/contacts.ts";
import { FavoriteSchema, QuerySchema, UpdateSchema, IdSchema } from "#/data/schemas.ts";
import { routes } from "#/routes.ts";
import { frame, render } from "#/utils/render.tsx";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { createHtmlResponse as html } from "remix/response/html";
import { redirect } from "remix/response/redirect";

import { sidebar } from "./sidebar.tsx";

async function contactPage(detail: (contact: Contact) => RemixNode) {
    try {
        let ctx = getContext();
        let target = ctx.headers.get("x-remix-target");
        let { id } = s.parse(IdSchema, ctx.params);

        if (target === "sidebar") {
            return sidebar(id);
        } else {
            let contact = await getContact(id);
            if (!contact) throw contact;

            if (target === "detail") {
                return frame(render(detail(contact)));
            }

            return html(render(<Document />));
        }
    } catch {
        return redirect(routes.home.href());
    }
}

export default {
    actions: {
        async show(ctx) {
            let { q } = s.parse(QuerySchema, ctx.url.searchParams);
            return await contactPage(contact => <ShowContact contact={contact} query={q} />);
        },
        async edit() {
            return await contactPage(contact => <EditContact contact={contact} />);
        },
        async create() {
            let id = await createContact();
            return redirect(routes.contacts.edit.href({ id }));
        },
        async destroy(ctx) {
            let { id } = s.parse(IdSchema, ctx.params);
            await deleteContact(id);
            return redirect(routes.home.href());
        },
        async favorite(ctx) {
            let { favorite } = s.parse(FavoriteSchema, ctx.get(FormData));
            let { id } = s.parse(IdSchema, ctx.params);
            let update = await updateContact(id, {
                favorite,
            });
            return Response.json(update);
        },
        async update(ctx) {
            let { id } = s.parse(IdSchema, ctx.params);
            let contact = await getContact(id);

            if (!contact) {
                return redirect(routes.home.href());
            }

            let updates = s.parse(UpdateSchema, ctx.get(FormData));

            // Preserve existing avatar when no new file is uploaded
            if (!updates.avatar) {
                updates.avatar = contact.avatar ?? "";
            }

            await updateContact(id, updates);

            return redirect(routes.contacts.show.href({ id: ctx.params.id }));
        },
    },
} satisfies Controller<typeof routes.contacts>;
