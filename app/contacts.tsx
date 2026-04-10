import type { Controller } from "remix/fetch-router";

import { EditContact } from "#/components/EditContact.tsx";
import { ShowContact } from "#/components/ShowContact.tsx";
import { getContact } from "#/data/contacts.ts";
import { QuerySchema, IdSchema } from "#/data/schemas.ts";
import { routes } from "#/routes.ts";
import { createFrameResponse as frame, Frame } from "#/utils/frame.tsx";
import { document } from "#/utils/render.tsx";
import * as s from "remix/data-schema";
import { redirect } from "remix/response/redirect";

export default {
    actions: {
        async show(ctx) {
            let target = ctx.get(Frame.Target);

            if (target.is("detail")) {
                let { q } = s.parse(QuerySchema, ctx.url.searchParams);
                let { id } = s.parse(IdSchema, ctx.params);
                let contact = await getContact(id);
                if (!contact) return redirect(routes.home.href());
                return frame(
                    <ShowContact initial={contact} query={q} setup={{ id: contact._id }} />,
                );
            }

            return await document();
        },
        async edit(ctx) {
            let target = ctx.get(Frame.Target);

            if (target.is("detail")) {
                let { id } = s.parse(IdSchema, ctx.params);
                let contact = await getContact(id);
                if (!contact) return redirect(routes.home.href());
                return frame(<EditContact contact={contact} />);
            }

            return await document();
        },
    },
} satisfies Controller<typeof routes.contacts>;
