import type { Contact } from "#/data/contacts.ts";
import type { Id } from "#convex/_generated/dataModel.js";

import { DeleteButton } from "#/components/Buttons.tsx";
import { Favorite } from "#/components/Favorite.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { ConvexQuery } from "#/utils/convex.tsx";
import { link } from "#/utils/frame.tsx";
import { api } from "#convex/_generated/api.js";
import { addEventListeners, clientEntry } from "remix/component";

import { Title } from "./Title.tsx";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export let ShowContact = clientEntry(import.meta.url, (handle, setup: { id: string }) => {
    let query = new ConvexQuery(
        api.contacts.get,
        { id: setup.id as Id<"contacts"> },
        { signal: handle.signal },
    );

    addEventListeners(query, handle.signal, {
        update() {
            handle.update();
        },
    });

    return (props: { initial: Contact; query?: string }) => {
        query.update({ id: props.initial._id as Id<"contacts"> });
        let contact = query.data ?? props.initial;

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
