import type { Contact } from "#/data/contacts.ts";

import { SidebarItem } from "#/components/SidebarItem.tsx";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { isServer, navigating } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";
import { addEventListeners, clientEntry, navigate, on } from "remix/component";

export let SidebarList = clientEntry(import.meta.url, handle => {
    let contacts: Contact[] = [];
    let query = "";
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
        query = props.query ?? "";

        let searching = Boolean(navigating.to.url?.searchParams.has("q"));
        let items = filtered();

        return (
            <>
                <div>
                    <form id="search-form" method="GET">
                        <input
                            aria-label="Search contacts"
                            class={searching ? "loading" : ""}
                            defaultValue={query || undefined}
                            id="q"
                            mix={on("input", async event => {
                                try {
                                    let url = new URL(location.href);

                                    if (!event.currentTarget.value.trim()) {
                                        url.searchParams.delete("q");
                                        query = "";
                                        handle.update();
                                        await navigate(url.toString(), {
                                            history: "replace",
                                        });
                                        return;
                                    }

                                    let isFirstSearch = url.searchParams.get("q") === null;
                                    url.searchParams.set("q", event.currentTarget.value);
                                    query = event.currentTarget.value;
                                    handle.update();
                                    await navigate(url.toString(), {
                                        history: isFirstSearch ? "replace" : "push",
                                    });
                                } catch {
                                    // ignore navigation errors caused by abortions during typing
                                }
                            })}
                            name="q"
                            placeholder="Search"
                            type="search"
                        />
                        <div aria-hidden hidden={!searching} id="search-spinner" />
                        <div aria-live="polite" class="sr-only" />
                    </form>
                    <button
                        mix={on("click", async () => {
                            let id = await client.mutation(api.contacts.create, {
                                first: "",
                                last: "",
                                bsky: "",
                            });
                            navigate(routes.contacts.edit.href({ id }), {
                                target: "detail",
                            });
                        })}
                        type="button"
                    >
                        New
                    </button>
                </div>
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
                                    query={query}
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
            </>
        );
    };
});
