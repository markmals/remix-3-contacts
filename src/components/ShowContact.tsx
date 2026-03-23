import { DeleteButton, EditButton } from "~/assets/Buttons.tsx";
import { Favorite } from "~/assets/Favorite.tsx";
import type { Contact } from "~/lib/database/contacts.ts";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export function ShowContact() {
    return (props: { contact: Contact; query: string | null }) => {
        return (
            <div id="detail">
                <div id="contact">
                    <div>
                        <img
                            alt=""
                            key={props.contact.avatar}
                            src={props.contact.avatar ? props.contact.avatar : AVATAR_PLACEHOLDER}
                        />
                    </div>

                    <div>
                        <h1>
                            {props.contact.first || props.contact.last ? (
                                <>
                                    {props.contact.first} {props.contact.last}
                                </>
                            ) : (
                                <i>No Name</i>
                            )}{" "}
                            <Favorite
                                contactId={props.contact.id}
                                favorite={props.contact.favorite ?? false}
                            />
                        </h1>

                        {props.contact.bsky ? (
                            <p>
                                <a
                                    href={`https://bsky.app/profile/${props.contact.bsky}`}
                                    rel="noreferrer"
                                    target="_blank"
                                >
                                    @{props.contact.bsky}
                                </a>
                            </p>
                        ) : null}

                        {props.contact.notes ? <p>{props.contact.notes}</p> : null}

                        <div>
                            <EditButton contactId={props.contact.id} query={props.query} />
                            <DeleteButton contactId={props.contact.id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
