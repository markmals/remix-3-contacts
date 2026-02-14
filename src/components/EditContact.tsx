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
                    <CancelButton />
                </p>
            </form>
        </div>
    );
}
