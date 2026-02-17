import type { BuildAction } from "remix/fetch-router";
import { EditContact } from "~/components/EditContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { render } from "~/lib/render.tsx";
import type { routes } from "~/routes.ts";

export const edit: BuildAction<"ANY", typeof routes.frame.edit> = async ({ params }) => {
    const contact = await getContact(Number(params.id));

    if (!contact) {
        return render.frame(<ZeroState />);
    }

    return render.frame(<EditContact contact={contact} />);
};
