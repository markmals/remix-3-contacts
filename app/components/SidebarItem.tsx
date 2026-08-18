import { routes } from "#/routes.ts";
import { link } from "#/utils/link.tsx";
import { isServer, navigating } from "#/utils/navigating.ts";
import { createMultiMatcher } from "remix/route-pattern/match";
import { addEventListeners, clientEntry, type Handle, type SerializableProps } from "remix/ui";

let matcher = createMultiMatcher<true>();
matcher.add(routes.contacts.show.pattern, true);
matcher.add(routes.contacts.edit.pattern, true);

export namespace SidebarItem {
    export interface Props extends SerializableProps {
        selected: string;
        query?: string;

        contact: {
            id: number;
            first?: string;
            last?: string;
            favorite?: boolean;
        };
    }
}

export let SidebarItem = clientEntry(import.meta.url, (handle: Handle<SidebarItem.Props>) => {
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return () => {
        let { selected, query, contact } = handle.props;
        // Derive active state from the current URL on the client,
        // since frame-targeted navigations don't re-render the sidebar
        // and the server-provided `selected` prop becomes stale.
        let currentMatch = !isServer ? matcher.match(location.href) : null;
        let isActive = Number(currentMatch?.params?.id ?? selected) === contact.id;

        // Only show pending for contacts that aren't already active
        let destination = navigating.to.url ? matcher.match(navigating.to.url.href) : null;
        let isPathChange = !isServer && navigating.to.url?.pathname !== location.pathname;
        let isPending = !isActive && isPathChange && Number(destination?.params.id) === contact.id;

        return (
            <li>
                <a
                    class={isActive ? "active" : isPending ? "pending" : undefined}
                    href={routes.contacts.show.href(
                        { id: contact.id },
                        { searchParams: { q: query } },
                    )}
                    mix={link({ target: "detail" })}
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
});
