import type { RemixNode } from "remix/component";
import type { Controller, RequestContext } from "remix/fetch-router";

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
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
import { frame, Frame } from "~/lib/frame.tsx";
import { document, sidebar } from "~/lib/render.tsx";
import { FavoriteSchema, QuerySchema, UpdateSchema } from "~/lib/schemas.ts";
import { routes } from "~/routes.ts";

let ParamsSchema = s.object({ id: coerce.number() });

async function contactPage(
    ctx: RequestContext<{ id: string }>,
    detail: (contact: Contact) => RemixNode,
) {
    try {
        let { id } = s.parse(ParamsSchema, ctx.params);

        if (ctx.get(Frame.Target).is("sidebar")) {
            return sidebar(id);
        }

        if (ctx.get(Frame.Target).is("detail")) {
            let contact = await getContact(id);
            if (!contact) return frame(<ZeroState />);
            return frame(detail(contact));
        }

        return document();
    } catch {
        return redirect(routes.home.href());
    }
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
            let { id } = s.parse(ParamsSchema, ctx.params);
            await deleteContact(id);
            return redirect(routes.home.href());
        },
        async favorite(ctx) {
            let { favorite } = s.parse(FavoriteSchema, ctx.get(FormData));
            let { id } = s.parse(ParamsSchema, ctx.params);
            let update = await updateContact(id, {
                favorite,
            });
            return Response.json(update);
        },
        async update(ctx) {
            let { id } = s.parse(ParamsSchema, ctx.params);
            let contact = await getContact(id);

            if (!contact) {
                return redirect(routes.home.href());
            }

            let updates = s.parse(UpdateSchema, ctx.get(FormData));
            await updateContact(id, updates);

            return redirect(routes.contacts.show.href({ id: ctx.params.id }));
        },
    },
} satisfies Controller<typeof routes.contacts>;
