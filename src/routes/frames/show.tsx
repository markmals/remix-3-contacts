import type { BuildAction } from "remix/fetch-router";
import { ShowContact } from "~/components/ShowContact.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact } from "~/lib/database/contacts.ts";
import { renderFrame } from "~/lib/responses/render.tsx";
import type { routes } from "~/routes.ts";

export const show: BuildAction<"ANY", typeof routes.frame.show> = async ({ request, params }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const contact = await getContact(Number(params.id));

    if (!contact) {
        return renderFrame(<ZeroState />);
    }

    return renderFrame(<ShowContact contact={contact} query={query} />);
};
