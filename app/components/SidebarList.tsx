import type { Contact } from "#/data/contacts.ts";

import { SidebarItem } from "#/components/SidebarItem.tsx";
import { client } from "#/utils/convex.tsx";
import { isServer, navigating } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";
import { addEventListeners, clientEntry } from "remix/component";

export let SidebarList = clientEntry(import.meta.url, handle => {
    let contacts: Contact[] = [];
    let unsubscribe: (() => void) | undefined;

    // Subscribe to contact list after hydration
    if (!isServer) {
        unsubscribe = client.onUpdate(api.contacts.list, {}, update => {
            contacts = update;
            handle.update();
        });

        handle.signal.addEventListener("abort", () => unsubscribe?.());
    }

    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    function filtered(): Contact[] {
        // Read query from URL so we react to SearchBar's navigate() calls
        let query = isServer ? "" : (new URL(location.href).searchParams.get("q") ?? "");
        let list = contacts;
        if (query) {
            list = matchSorter(list, query, { keys: ["first", "last"] });
        }
        return sortBy(list, [c => c.last, c => c._creationTime]);
    }

    return (props: { contacts: Contact[]; query?: string }) => {
        // Use props for initial server render, subscription data after hydration
        if (isServer || contacts.length === 0) {
            contacts = props.contacts;
        }

        // On the server, use the query from props for initial filtering
        let items: Contact[];
        if (isServer && props.query) {
            items = matchSorter(props.contacts, props.query, { keys: ["first", "last"] });
            items = sortBy(items, [c => c.last, c => c._creationTime]);
        } else {
            items = filtered();
        }

        return (
            <nav>
                {items.length ? (
                    <ul>
                        {items.map(contact => (
                            <SidebarItem
                                contact={{
                                    id: contact._id,
                                    first: contact.first,
                                    last: contact.last,
                                    favorite: contact.favorite,
                                }}
                                query={props.query}
                                selected=""
                            />
                        ))}
                    </ul>
                ) : (
                    <p>
                        <i>No contacts</i>
                    </p>
                )}
            </nav>
        );
    };
});
