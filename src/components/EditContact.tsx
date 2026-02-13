import type { Handle } from "remix/component";
import { buildShowHref } from "~/lib/contact-links.ts";
import type { Contact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export function EditContact(
    _handle: Handle,
    setup: {
        contact: Contact;
        query: string | null;
    },
) {
    const showHref = buildShowHref(setup.contact.id, setup.query);

    return () => (
        <div id="detail">
            <form action={routes.contacts.show.href()} id="contact-form" method="post">
                <input name="_method" type="hidden" value="PUT" />
                <input name="id" type="hidden" value={setup.contact.id} />

                <p>
                    <span>Name</span>
                    <input
                        aria-label="First name"
                        defaultValue={setup.contact.first || undefined}
                        name="first"
                        placeholder="First"
                        type="text"
                    />
                    <input
                        aria-label="Last name"
                        defaultValue={setup.contact.last || undefined}
                        name="last"
                        placeholder="Last"
                        type="text"
                    />
                </p>

                <label>
                    <span>Bluesky</span>
                    <input
                        defaultValue={setup.contact.bsky || undefined}
                        name="bsky"
                        placeholder="jay.bsky.team"
                        type="text"
                    />
                </label>

                <label>
                    <span>Avatar URL</span>
                    <input
                        aria-label="Avatar URL"
                        defaultValue={setup.contact.avatar || undefined}
                        name="avatar"
                        placeholder="https://example.com/avatar.jpg"
                        type="text"
                    />
                </label>

                <label>
                    <span>Notes</span>
                    <textarea
                        defaultValue={setup.contact.notes || undefined}
                        name="notes"
                        rows={6}
                    />
                </label>

                <p>
                    <button type="submit">Save</button>
                    <a href={showHref}>Cancel</a>
                </p>
            </form>
        </div>
    );
}
