import {
    addEventListeners,
    clientEntry,
    type Handle,
    type SerializableProps,
} from "remix/component";
import { ArrayMatcher } from "remix/route-pattern";
import { isServer, navigating } from "~/lib/navigating.ts";
import { routes } from "~/routes.ts";

const matcher = new ArrayMatcher<true>();
matcher.add(routes.contacts.show.pattern.source, true);
matcher.add(routes.contacts.edit.pattern.source, true);

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
            // Derive active state from the current URL on the client,
            // since frame-targeted navigations don't re-render the sidebar
            // and the server-provided `selected` prop becomes stale.
            const currentMatch = !isServer ? matcher.match(window.location.href) : null;
            const isActive = Number(currentMatch?.params?.id ?? selected) === contact.id;

            // Only show pending for contacts that aren't already active
            const destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
            const isPathChange = !isServer && navigating.to.url?.pathname !== window.location.pathname;
            const isPending = !isActive && isPathChange && Number(destination?.params.id) === contact.id;

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
