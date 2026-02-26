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
    async sidebar({ url }) {
        const query = url.searchParams.get("q");
        const selected = url.searchParams.get("selected");
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
    async edit({ params }) {
        const contact = await getContact(Number(params.id));

        if (!contact) {
            return render.frame(<ZeroState />);
        }

        return render.frame(<EditContact contact={contact} />);
    },
    async show({ params, url }) {
        const contact = await getContact(Number(params.id));

        if (!contact) {
            return render.frame(<ZeroState />);
        }

        return render.frame(<ShowContact contact={contact} query={url.searchParams.get("q")} />);
    },
} satisfies Controller<typeof routes.frame>;
