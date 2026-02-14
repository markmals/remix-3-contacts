import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { Document } from "~/components/Document.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { renderDoc } from "~/lib/render.tsx";
import { routes } from "~/routes.ts";

export const show: BuildAction<"GET", typeof routes.contacts.show> = async ({ params }) => {
    if (!params.id) {
        return redirect(routes.home.href());
    }

    const contact = await getContact(Number(params.id));

    if (!contact) {
        return redirect(routes.home.href());
    }

    return renderDoc(<Document />);
};
