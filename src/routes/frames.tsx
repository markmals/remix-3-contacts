import { matchSorter } from "match-sorter";
import type { Controller } from "remix/fetch-router";
import { EditContact } from "~/components/EditContact.tsx";
import { ShowContact } from "~/components/ShowContact.tsx";
import { Sidebar } from "~/components/Sidebar.tsx";
import { ZeroState } from "~/components/ZeroState.tsx";
import { getContact, getContacts } from "~/lib/database/contacts.ts";
import { render } from "~/lib/render.tsx";
import type { routes } from "~/routes.ts";

export default {
    actions: {
        async sidebar(context) {
            const query = context.url.searchParams.get("q");
            const selected = context.url.searchParams.get("selected");
            let contacts = await getContacts(query);

            if (query) {
                contacts = matchSorter(contacts, query, {
                    keys: ["first", "last"],
                });
            }

            return render.frame(<Sidebar contacts={contacts} query={query} selected={selected} />);
        },
        zero() {
            return render.frame(<ZeroState />);
        },
        async edit(context) {
            const contact = await getContact(Number(context.params.id));

            if (!contact) {
                return render.frame(<ZeroState />);
            }

            return render.frame(<EditContact contact={contact} />);
        },
        async show(context) {
            const contact = await getContact(Number(context.params.id));

            if (!contact) {
                return render.frame(<ZeroState />);
            }

            return render.frame(
                <ShowContact contact={contact} query={context.url.searchParams.get("q")} />,
            );
        },
    },
} satisfies Controller<typeof routes.frame>;
