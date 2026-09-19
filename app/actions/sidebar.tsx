import type { RenderFunction } from "remix/middleware/render";

import { SidebarItem } from "#/actions/contacts/public/sidebar-item.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import * as s from "remix/data-schema";

/** The slice of the request context the sidebar frame needs. */
type SidebarContext = {
    render: RenderFunction;
    url: URL;
};

/** Renders the `sidebar` frame. Shared by the root and contacts controllers. */
export async function sidebar(ctx: SidebarContext, selected?: number): Promise<Response> {
    let { q } = s.parse(QuerySchema, ctx.url.searchParams);
    let contacts = await getContacts(q);

    return ctx.render(
        <nav>
            {contacts.length ? (
                <ul>
                    {contacts.map(contact => (
                        <SidebarItem
                            contact={contact}
                            query={q}
                            selected={String(selected ?? "")}
                        />
                    ))}
                </ul>
            ) : (
                <p>
                    <i>No contacts</i>
                </p>
            )}
        </nav>,
    );
}
