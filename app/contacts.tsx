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
import { document, isFrame, frame, sidebar } from "~/lib/render.tsx";
import { routes } from "~/routes.ts";

import { FavoriteSchema, QuerySchema, UpdateSchema } from "./lib/schemas.ts";

async function contactPage(
    ctx: RequestContext<{ id: string }>,
    detail: (contact: Contact) => RemixNode,
) {
    if (!ctx.params.id) {
        return redirect(routes.home.href());
    }

    if (isFrame(ctx, "sidebar")) return await sidebar(ctx.params.id);

    if (isFrame(ctx, "detail")) {
        let contact = await getContact(Number(ctx.params.id));
        if (!contact) return frame(<ZeroState />);
        return frame(detail(contact));
    }

    return document();
}

export default {
    actions: {
        async show(ctx) {
            let { q } = s.parse(QuerySchema, ctx.url.searchParams);
            return await contactPage(ctx, contact => <ShowContact contact={contact} query={q} />);
        },
        async edit(ctx) {
            return await contactPage(ctx, contact => <EditContact contact={contact} />);
        },
        async create() {
            let id = await createContact();
            return redirect(routes.contacts.edit.href({ id }));
        },
        async destroy(ctx) {
            await deleteContact(Number(ctx.params.id));
            return redirect(routes.home.href());
        },
        async favorite(ctx) {
            let { favorite } = s.parse(FavoriteSchema, ctx.get(FormData));
            let update = await updateContact(Number(ctx.params.id), {
                favorite,
            });
            return Response.json(update);
        },
        async update(ctx) {
            let contact = await getContact(Number(ctx.params.id));

            if (!contact) {
                return redirect(routes.home.href());
            }

            let updates = s.parse(UpdateSchema, ctx.get(FormData));
            await updateContact(Number(ctx.params.id), updates);

            return redirect(routes.contacts.show.href({ id: ctx.params.id }));
        },
    },
} satisfies Controller<typeof routes.contacts>;
