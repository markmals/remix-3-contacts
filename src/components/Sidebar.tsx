import { SidebarItem } from "~/assets/SidebarItem.tsx";
import type { Contact } from "~/lib/database/contacts.ts";

export function Sidebar() {
    return (props: { contacts: Contact[]; selected: string | null; query: string | null }) => {
        return (
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
        );
    };
}
