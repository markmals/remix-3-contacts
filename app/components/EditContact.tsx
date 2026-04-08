import type { Contact } from "#/data/contacts.ts";

import { CancelButton } from "#/components/Buttons.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";

import { RestfulForm } from "./RestfulForm.tsx";
import { Title } from "./Title.tsx";

export function EditContact() {
    return (props: { contact: Contact }) => (
        <div id="detail">
            <Title>
                Edit {props.contact.first} {props.contact.last} | {SITE.title}
            </Title>
            <RestfulForm
                action={routes.contacts.update.href({ id: props.contact.id })}
                enctype="multipart/form-data"
                id="contact-form"
                method={routes.contacts.update.method}
            >
                <p>
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
                </p>

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
                    {props.contact.avatar ? (
                        <img
                            alt="Current avatar"
                            src={props.contact.avatar}
                            style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 0.5rem;"
                        />
                    ) : null}
                    <input accept="image/*" name="avatar" type="file" />
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
