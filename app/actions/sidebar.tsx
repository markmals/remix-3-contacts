import { SidebarItem } from "#/components/SidebarItem.tsx";
import { getContacts } from "#/data/contacts.ts";
import { QuerySchema } from "#/data/schemas.ts";
import { frame, render } from "#/utils/render.tsx";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";

export async function sidebar(selected?: string | number): Promise<Response> {
    let { url } = getContext();
    let { q } = s.parse(QuerySchema, url.searchParams);
    let contacts = await getContacts(q);

    return frame(
        render(
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
        ),
    );
}
