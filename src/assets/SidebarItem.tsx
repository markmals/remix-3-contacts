import { clientEntry, type Handle, type SerializableProps } from "remix/component";
import { matchContactRoute } from "~/lib/frame-utils.ts";
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
    "/assets/SidebarItem.js#SidebarItem",
    function SidebarItem(handle: Handle) {
        let destinationUrl: string | null = null;

        if (typeof window !== "undefined") {
            handle.on(navigation, {
                navigate(event) {
                    destinationUrl = event.destination.url;
                    handle.update();
                },
                navigatesuccess() {
                    destinationUrl = null;
                    handle.update();
                },
                navigateerror() {
                    destinationUrl = null;
                    handle.update();
                },
            });
        }

        return ({ selected, query, contact }: SidebarItem.Props) => {
            const destinationMatch = destinationUrl ? matchContactRoute(destinationUrl) : null;
            const isPending = Number(destinationMatch?.id) === contact.id;
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
