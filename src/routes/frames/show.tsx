import type { BuildAction } from "remix/fetch-router";
import { ShowContact } from "~/components/ShowContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { render } from "~/lib/render.tsx";
import type { routes } from "~/routes.ts";

export const show: BuildAction<"ANY", typeof routes.frame.show> = async ({ url, params }) => {
    const contact = await getContact(Number(params.id));

    if (!contact) {
        return render.frame(<ZeroState />);
    }

    return render.frame(<ShowContact contact={contact} query={url.searchParams.get("q")} />);
};
