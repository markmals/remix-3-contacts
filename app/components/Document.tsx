import type { Contact } from "#/data/contacts.ts";
import type { SerializableProps } from "remix/component";

import { SidebarItem } from "#/components/SidebarItem.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { convex } from "#/utils/convex.ts";
import { isServer, navigating } from "#/utils/navigating.ts";
import { search } from "#/utils/search.ts";
import { api } from "#convex/_generated/api.js";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";
import { addEventListeners, clientEntry, navigate, on } from "remix/component";
import { Frame as RemixFrame } from "remix/component";

export interface DocumentProps extends SerializableProps {
    contacts: Contact[];
    query?: string;
    url: string;
    styles: string;
    clientScript: string;
    css: Array<Record<string, string>>;
    js: Array<Record<string, string>>;
}

export let Document = clientEntry(import.meta.url, handle => {
    let contacts: Contact[] = [];
    let unsubscribe: (() => void) | undefined;

    if (!isServer) {
        unsubscribe = convex.client.onUpdate(api.contacts.list, {}, update => {
            contacts = update;
            handle.update();
        });

        handle.signal.addEventListener("abort", () => unsubscribe?.());
    }

    // Re-render when search query changes
    addEventListeners(search, handle.signal, {
        change() {
            handle.update();
        },
    });

    // Re-render when navigation state changes (for pending SidebarItems)
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    function filtered(query: string): Contact[] {
        let list = contacts;
        if (query) {
            list = matchSorter(list, query, { keys: ["first", "last"] });
        }
        return sortBy(list, ["last", "_creationTime"]);
    }

    return (props: DocumentProps) => {
        // Use props for initial server render, subscription data after hydration
        if (isServer || contacts.length === 0) {
            contacts = props.contacts;
        }

        let query = isServer ? (props.query ?? "") : search.query;
        let items = filtered(query);

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{SITE.title}</title>

                    <link href="/favicon-32.png" rel="icon" sizes="32x32" />
                    <link href="/favicon-128.png" rel="icon" sizes="128x128" />
                    <link href="/favicon-180.png" rel="icon" sizes="180x180" />
                    <link href="/favicon-192.png" rel="icon" sizes="192x192" />
                    <link href="/favicon-180.png" rel="apple-touch-icon" sizes="180x180" />

                    <link href={props.styles} rel="stylesheet" />
                    {props.css.map(attrs => (
                        <link key={attrs.href} {...attrs} rel="stylesheet" />
                    ))}

                    <script async src={props.clientScript} type="module" />
                    {props.js.map(attrs => (
                        <link key={attrs.href} {...attrs} rel="modulepreload" />
                    ))}
                </head>
                <body>
                    <div id="root">
                        <div id="sidebar">
                            <h1>{SITE.title}</h1>
                            <div>
                                <form id="search-form" method="GET">
                                    <input
                                        aria-label="Search contacts"
                                        defaultValue={props.query ?? undefined}
                                        id="q"
                                        mix={on("input", event => {
                                            search.update(event.currentTarget.value.trim());
                                        })}
                                        name="q"
                                        placeholder="Search"
                                        type="search"
                                    />
                                    <div aria-hidden hidden id="search-spinner" />
                                    <div aria-live="polite" class="sr-only" />
                                </form>
                                <button
                                    mix={on("click", async () => {
                                        let id = await convex.client.mutation(api.contacts.create, {
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
                        </div>
                        <RemixFrame name="detail" src={props.url} />
                    </div>
                </body>
            </html>
        );
    };
});
