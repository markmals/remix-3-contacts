import type { Contact } from "#/data/contacts.ts";

import { DeleteButton } from "#/components/Buttons.tsx";
import { Favorite } from "#/components/Favorite.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { link } from "#/utils/frame.tsx";
import { isServer } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { ConvexClient } from "convex/browser";
import { clientEntry } from "remix/component";

import { RestfulForm } from "./RestfulForm.tsx";
import { Title } from "./Title.tsx";

let client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export let ShowContact = clientEntry(import.meta.url, handle => {
    let contact: Contact | null = null;
    let unsubscribe: (() => void) | undefined;

    return (props: { initial: Contact; query?: string }) => {
        contact ??= props.initial;

        if (!isServer && contact._id !== props.initial._id) {
            contact = props.initial;
            unsubscribe?.();

            unsubscribe = client.onUpdate(api.contacts.get, { id: props.initial._id }, update => {
                contact = update;
                handle.update();
            });
        }

        return (
            <div id="detail">
                <Title>
                    {contact.first} {contact.last} | {SITE.title}
                </Title>
                <div id="contact">
                    <div>
                        <img
                            alt=""
                            key={contact.avatar}
                            src={contact.avatar ? contact.avatar : AVATAR_PLACEHOLDER}
                        />
                    </div>

                    <div>
                        <h1>
                            {contact.first || contact.last ? (
                                <>
                                    {contact.first} {contact.last}
                                </>
                            ) : (
                                <i>No Name</i>
                            )}{" "}
                            <Favorite
                                contactId={contact._id}
                                favorite={contact.favorite ?? false}
                            />
                        </h1>

                        {contact.bsky ? (
                            <p>
                                <a
                                    href={`https://bsky.app/profile/${contact.bsky}`}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    @{contact.bsky}
                                </a>
                            </p>
                        ) : null}

                        {contact.notes ? <p>{contact.notes}</p> : null}

                        <div>
                            <RestfulForm
                                action={routes.contacts.edit.href(
                                    { id: contact._id },
                                    { q: props.query },
                                )}
                                method={routes.contacts.edit.method}
                            >
                                <button mix={link({ target: "detail" })} type="submit">
                                    Edit
                                </button>
                            </RestfulForm>
                            <DeleteButton contactId={contact._id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
});
