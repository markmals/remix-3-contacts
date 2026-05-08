import type { Contact } from "#/data/contacts.ts";

import { CancelButton } from "#/components/Buttons.tsx";
import { ALLOWED_TYPES } from "#/controllers/uploads.ts";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { Head } from "#/utils/metadata/index.ts";

import { RestfulForm } from "./RestfulForm.tsx";

function contactName(contact: Contact): string {
    let name = `${contact.first ?? ""} ${contact.last ?? ""}`.trim();
    return name || "No Name";
}

export function EditContact() {
    return (props: { contact: Contact }) => (
        <div id="detail">
            <Head owner={`contact-edit-${props.contact.id}`}>
                <title>{`Edit ${contactName(props.contact)} · ${SITE.title}`}</title>
            </Head>
            <RestfulForm
                action={routes.contacts.update.href({ id: props.contact.id })}
                enctype="multipart/form-data"
                id="contact-form"
                method={routes.contacts.update.method}
            >
                <label>
                    <span>Name</span>
                    <input
                        aria-label="First name"
                        name="first"
                        placeholder="First"
                        type="text"
                        value={props.contact.first || undefined}
                    />
                    <input
                        aria-label="Last name"
                        name="last"
                        placeholder="Last"
                        type="text"
                        value={props.contact.last || undefined}
                    />
                </label>

                <label>
                    <span>Bluesky</span>
                    <input
                        name="bsky"
                        placeholder="jay.bsky.team"
                        type="text"
                        value={props.contact.bsky || undefined}
                    />
                </label>

                <label>
                    <span>Avatar</span>
                    <div id="contact-form-avatar">
                        <img
                            alt="Current avatar"
                            src={
                                props.contact.avatar ||
                                "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"
                            }
                        />
                        <label class="avatar-upload">
                            <input
                                accept={ALLOWED_TYPES.join(",")}
                                hidden
                                name="avatar"
                                type="file"
                            />
                            <span>Choose Photo</span>
                        </label>
                    </div>
                </label>

                <label>
                    <span>Notes</span>
                    <textarea name="notes" rows={6} value={props.contact.notes || undefined} />
                </label>

                <p>
                    <button type="submit">Save</button>
                    <CancelButton />
                </p>
            </RestfulForm>
        </div>
    );
}
