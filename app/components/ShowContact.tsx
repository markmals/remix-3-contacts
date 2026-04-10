import type { Contact } from "#/data/contacts.ts";

import { DeleteButton } from "#/components/Buttons.tsx";
import { Favorite } from "#/components/Favorite.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { link } from "#/utils/frame.tsx";
import { isServer } from "#/utils/navigating.ts";
import { api } from "#convex/_generated/api.js";
import { clientEntry } from "remix/component";

import { Title } from "./Title.tsx";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export let ShowContact = clientEntry(import.meta.url, handle => {
    let contact: Contact | null = null;
    let unsubscribe: (() => void) | undefined;
    let subscribedId: string | undefined;

    handle.signal.addEventListener("abort", () => unsubscribe?.());

    return (props: { initial: Contact; query?: string }) => {
        contact ??= props.initial;

        // Subscribe on first client render and resubscribe when contact changes
        if (!isServer && subscribedId !== props.initial._id) {
            contact = props.initial;
            subscribedId = props.initial._id;
            unsubscribe?.();

            let initialDelivery = true;
            unsubscribe = client.onUpdate(api.contacts.get, { id: props.initial._id }, update => {
                contact = update;

                // Skip re-render for the initial delivery — we already have
                // this data from SSR. Only re-render on actual changes.
                if (initialDelivery) {
                    initialDelivery = false;
                    return;
                }

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
                            key={contact.avatarUrl}
                            src={contact.avatarUrl ? contact.avatarUrl : AVATAR_PLACEHOLDER}
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
                            <a
                                href={routes.contacts.edit.href(
                                    { id: contact._id },
                                    { q: props.query },
                                )}
                                mix={link({ target: "detail" })}
                            >
                                <button type="button">Edit</button>
                            </a>
                            <DeleteButton contactId={contact._id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
});
