import type { Handle } from "remix/component";
import { Search } from "~/assets/Search.tsx";
import type { Contact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export function Sidebar(
    _handle: Handle,
    setup: {
        contacts: Contact[];
        query: string | null;
        selectedId: string | null;
    },
) {
    return () => (
        <div id="sidebar">
            <h1>Remix 3 Contacts</h1>
            <div>
                <Search setup={{ query: setup.query }} />
                <form action={routes.contacts.create.href()} method="post">
                    <button type="submit">New</button>
                </form>
            </div>
            <nav>
                {setup.contacts.length ? (
                    <ul>
                        {setup.contacts.map(contact => {
                            const href = routes.contacts.show.href(
                                { id: contact.id },
                                { q: setup.query },
                            );
                            const isActive = setup.selectedId === contact.id;
                            const className = isActive ? "active" : "";

                            return (
                                <li key={contact.id}>
                                    <a class={className} href={href}>
                                        {contact.first || contact.last ? (
                                            <>
                                                {contact.first} {contact.last}
                                            </>
                                        ) : (
                                            <i>No Name</i>
                                        )}
                                        {contact.favorite ? <span>★</span> : null}
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p>
                        <i>No contacts</i>
                    </p>
                )}
            </nav>
        </div>
    );
}
