import type { Contact } from "#/data/contacts.ts";
import type { SerializableProps } from "remix/component";

import { SidebarItem } from "#/components/SidebarItem.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { ConvexQuery, mutate } from "#/utils/convex.tsx";
import { search } from "#/utils/search.ts";
import { IS_SERVER } from "#/utils/server.ts";
import { api } from "#convex/_generated/api.js";
import { sortBy } from "es-toolkit/array";
import { matchSorter } from "match-sorter";
import { addEventListeners, clientEntry, navigate, on } from "remix/component";
import { Frame } from "remix/component";

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
    let contactsQuery = new ConvexQuery(api.contacts.list, {}, { signal: handle.signal });

    // Re-render when subscription data or search query changes
    addEventListeners(contactsQuery, handle.signal, {
        update() {
            handle.update();
        },
    });

    addEventListeners(search, handle.signal, {
        change() {
            handle.update();
        },
    });

    function filtered(contacts: Contact[], query: string): Contact[] {
        let list = contacts;
        if (query) {
            list = matchSorter(list, query, { keys: ["first", "last"] });
        }
        return sortBy(list, ["last", "_creationTime"]);
    }

    return (props: DocumentProps) => {
        let contacts = contactsQuery.data ?? props.contacts;
        let query = IS_SERVER ? (props.query ?? "") : search.query;
        let items = filtered(contacts, query);

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
                                <form
                                    mix={[
                                        mutate(api.contacts.create, {
                                            first: "",
                                            last: "",
                                            bsky: "",
                                        }),
                                        on(mutate.success, event => {
                                            console.log(event);
                                            navigate(
                                                routes.contacts.edit.href({
                                                    id: (event.result as any).id,
                                                }),
                                                { target: "detail" },
                                            );
                                        }),
                                    ]}
                                >
                                    <button type="button">New</button>
                                </form>
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
                        <Frame name="detail" src={props.url} />
                    </div>
                </body>
            </html>
        );
    };
});
