import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { Document } from "~/components/Document.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { render } from "~/lib/responses/render.tsx";
import { routes } from "~/routes.ts";

export const edit: BuildAction<"GET", typeof routes.contacts.edit> = async ({ params }) => {
    if (!params.id) {
        return redirect(routes.home.href());
    }

    const contact = await getContact(params.id);

    if (!contact) {
        return redirect(routes.home.href());
    }

    return render(<Document />);
};
