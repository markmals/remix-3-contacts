import {
    addEventListeners,
    clientEntry,
    type Handle,
    type SerializableProps,
} from "remix/component";
import { frames } from "~/frames.ts";
import { navigating } from "~/lib/navigation.ts";
import { routes } from "~/routes.ts";

export namespace SidebarItem {
    export interface Props extends SerializableProps {
        // Ideally `selected` and `query` could be derived from context,
        // but context doesn't seem to be working through Frames yet.
        selected: string | null;
        query: string | null;

        contact: {
            id: number;
            first?: string;
            last?: string;
            favorite?: boolean;
        };
    }
}

export const SidebarItem = clientEntry(
    routes.assets.href({ file: "SidebarItem", component: "SidebarItem" }),
    function SidebarItem(handle: Handle) {
        addEventListeners(navigating, handle.signal, {
            destinationchange() {
                handle.update();
            },
        });

        return ({ selected, query, contact }: SidebarItem.Props) => {
            const destination = frames.$.match(navigating.to.url);
            const isPending = Number(destination?.params.id) === contact.id;
            const isActive = Number(selected) === contact.id;

            return (
                <li>
                    <a
                        class={isActive ? "active" : isPending ? "pending" : undefined}
                        href={routes.contacts.show.href({ id: contact.id }, { q: query })}
                    >
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
        };
    },
);
