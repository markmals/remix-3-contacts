import type { Handle } from "remix/component";
import { CancelButton } from "~/assets/CancelButton.tsx";
import type { Contact } from "~/lib/database/contacts.ts";
import { routes } from "~/routes.ts";

export function EditContact(_handle: Handle, setup: { contact: Contact }) {
    return () => (
        <div id="detail">
            <form
                action={routes.contacts.update.href({ id: setup.contact.id })}
                id="contact-form"
                method="POST"
            >
                <input name="_method" type="hidden" value="PUT" />

                <p>
                    <span>Name</span>
                    <input
                        aria-label="First name"
                        name="first"
                        placeholder="First"
                        type="text"
                        value={setup.contact.first || undefined}
                    />
                    <input
                        aria-label="Last name"
                        name="last"
                        placeholder="Last"
                        type="text"
                        value={setup.contact.last || undefined}
                    />
                </p>

                <label>
                    <span>Bluesky</span>
                    <input
                        name="bsky"
                        placeholder="jay.bsky.team"
                        type="text"
                        value={setup.contact.bsky || undefined}
                    />
                </label>

                <label>
                    <span>Avatar URL</span>
                    <input
                        aria-label="Avatar URL"
                        name="avatar"
                        placeholder="https://example.com/avatar.jpg"
                        type="text"
                        value={setup.contact.avatar || undefined}
                    />
                </label>

                <label>
                    <span>Notes</span>
                    <textarea name="notes" rows={6} value={setup.contact.notes || undefined} />
                </label>

                <p>
                    <button type="submit">Save</button>
                    <CancelButton />
                </p>
            </form>
        </div>
    );
}
