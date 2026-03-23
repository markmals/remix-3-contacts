import {
    addEventListeners,
    clientEntry,
    type Handle,
    type SerializableProps,
} from "remix/component";
import { TrieMatcher } from "remix/route-pattern";
import { navigating } from "~/lib/navigating.ts";
import { routes } from "~/routes.ts";

const matcher = new TrieMatcher<true>();
matcher.add(routes.contacts.show.pattern, true);
matcher.add(routes.contacts.edit.pattern, true);

export namespace SidebarItem {
    export interface Props extends SerializableProps {
        selected: string;
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
            const destination = navigating.to.url ? matcher.match(navigating.to.url) : null;
            const isPending = Number(destination?.params.id) === contact.id;
            const isActive = Number(selected) === contact.id;

            return (
                <li>
                    <a
                        class={isActive ? "active" : isPending ? "pending" : undefined}
                        href={routes.contacts.show.href({ id: contact.id }, { q: query })}
                        rmx-target="detail"
                    >
                        {contact.first || contact.last ? (
                            <>
                                {contact.first} {contact.last}
                            </>
                        ) : (
                            <i>No Name</i>
                        )}
                        {contact.favorite ? <span>{"\u2605"}</span> : null}
                    </a>
                </li>
            );
        };
    },
);
