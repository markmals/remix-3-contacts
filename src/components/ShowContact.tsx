import type { Handle } from "remix/component";
import { DeleteConfirm } from "~/assets/DeleteConfirm.tsx";
import { Favorite } from "~/assets/Favorite.tsx";
import { buildEditHref } from "~/lib/contact-links.ts";
import type { Contact } from "~/lib/database/contacts.ts";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export function ShowContact(
    _handle: Handle,
    setup: {
        contact: Contact;
        query: string | null;
    },
) {
    const hasAvatar = Boolean(setup.contact.avatar);

    return () => (
        <div id="detail">
            <div id="contact">
                <div>
                    <img
                        alt=""
                        key={setup.contact.avatar}
                        src={hasAvatar ? setup.contact.avatar : AVATAR_PLACEHOLDER}
                    />
                </div>

                <div>
                    <h1>
                        {setup.contact.first || setup.contact.last ? (
                            <>
                                {setup.contact.first} {setup.contact.last}
                            </>
                        ) : (
                            <i>No Name</i>
                        )}{" "}
                        <Favorite
                            contactId={setup.contact.id}
                            setup={{ favorite: setup.contact.favorite ?? false }}
                        />
                    </h1>

                    {setup.contact.bsky ? (
                        <p>
                            <a
                                href={`https://bsky.app/profile/${setup.contact.bsky}`}
                                rel="noreferrer"
                                target="_blank"
                            >
                                @{setup.contact.bsky}
                            </a>
                        </p>
                    ) : null}

                    {setup.contact.notes ? <p>{setup.contact.notes}</p> : null}

                    <div>
                        <a href={buildEditHref(setup.contact.id, setup.query)}>Edit</a>
                        <DeleteConfirm contactId={setup.contact.id} />
                    </div>
                </div>
            </div>
        </div>
    );
}
