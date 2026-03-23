import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import { NewButton } from "~/assets/Buttons.tsx";
import { SidebarItem } from "~/assets/SidebarItem.tsx";
import { SearchBar } from "~/assets/SearchBar.tsx";
import type { Contact } from "~/lib/database/contacts.ts";

export function Document() {
    const { url } = getContext();

    return (props: { contacts: Contact[]; query: string | null; selected: string }) => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <title>Remix 3 Contacts</title>
                <link href="/index.css" rel="stylesheet" />
                <link href="/favicon-32.png" rel="icon" sizes="32x32" />
                <link href="/favicon-128.png" rel="icon" sizes="128x128" />
                <link href="/favicon-180.png" rel="icon" sizes="180x180" />
                <link href="/favicon-192.png" rel="icon" sizes="192x192" />
                <link href="/favicon-180.png" rel="apple-touch-icon" sizes="180x180" />
                <script async src="/assets/entry.js" type="module" />
            </head>
            <body>
                <div id="root">
                    <div id="sidebar">
                        <h1>Remix 3 Contacts</h1>
                        <div>
                            <SearchBar query={props.query} />
                            <NewButton />
                        </div>
                        <nav>
                            {props.contacts.length ? (
                                <ul>
                                    {props.contacts.map(contact => (
                                        <SidebarItem
                                            contact={contact}
                                            query={props.query}
                                            selected={props.selected}
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
                    <Frame name="detail" src={url.toString()} />
                </div>
            </body>
        </html>
    );
}
