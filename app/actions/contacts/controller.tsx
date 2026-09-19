import type { PageMetadata } from "#/utils/page-metadata.ts";
import type { RenderFunction } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import { EditContact } from "#/actions/contacts/form.tsx";
import { ShowContact } from "#/actions/contacts/show-page.tsx";
import { sidebar } from "#/actions/sidebar.tsx";
import {
    type Contact,
    contactName,
    createContact,
    deleteContact,
    getContact,
    updateContact,
} from "#/data/contacts.ts";
import { SITE } from "#/data/meta.ts";
import { FavoriteSchema, IdSchema, QuerySchema, UpdateSchema } from "#/data/schemas.ts";
import { routes } from "#/routes.ts";
import { Document } from "#/ui/document.tsx";
import { frameTarget } from "#/utils/frames.ts";
import { pageMetadataHeaders } from "#/utils/page-metadata.ts";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";

/** A contact's detail-frame content plus the page metadata that describes it. */
type DetailPage = PageMetadata & { node: RemixNode };

/** The slice of the request context a contact page needs. */
type ContactContext = {
    headers: Headers;
    params: Record<string, string | undefined>;
    render: RenderFunction;
    url: URL;
};

/**
 * Serves whichever of the three shapes the request asked for: the `sidebar`
 * frame, the `detail` frame, or the whole document.
 */
async function contactPage(
    ctx: ContactContext,
    detail: (contact: Contact) => DetailPage,
): Promise<Response> {
    let { id } = s.parse(IdSchema, ctx.params);
    let target = frameTarget(ctx.headers);

    if (target === "sidebar") {
        return sidebar(ctx, id);
    }

    let contact = await getContact(id);
    if (!contact) {
        return redirect(routes.home.href());
    }

    let page = detail(contact);

    if (target === "detail") {
        return ctx.render(page.node, { headers: pageMetadataHeaders(page) });
    }

    return ctx.render(<Document description={page.description} title={page.title} />);
}

export default createController(routes.contacts, {
    actions: {
        async show(ctx) {
            let { q } = s.parse(QuerySchema, ctx.url.searchParams);

            return await contactPage(ctx, contact => ({
                description: contact.notes || (contact.bsky ? `@${contact.bsky}` : undefined),
                node: <ShowContact contact={contact} query={q} />,
                title: `${contactName(contact)} · ${SITE.title}`,
            }));
        },
        async edit(ctx) {
            return await contactPage(ctx, contact => ({
                node: <EditContact contact={contact} />,
                title: `Edit ${contactName(contact)} · ${SITE.title}`,
            }));
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
            let { favorite } = s.parse(FavoriteSchema, ctx.formData);
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

            let updates = s.parse(UpdateSchema, ctx.formData);

            // Preserve existing avatar when no new file is uploaded
            if (!updates.avatar) {
                updates.avatar = contact.avatar ?? "";
            }

            await updateContact(id, updates);

            return redirect(routes.contacts.show.href({ id: ctx.params.id }));
        },
    },
});
