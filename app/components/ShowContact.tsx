import type { Contact } from "~/lib/database/contacts.ts";

import { DeleteButton } from "~/components/Buttons.tsx";
import { Favorite } from "~/components/Favorite.tsx";
import { Frame } from "~/lib/frame.tsx";
import { SITE } from "~/lib/meta.ts";
import { routes } from "~/routes.ts";

import { Title } from "./Title.tsx";

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export function ShowContact() {
    return (props: { contact: Contact; query?: string }) => {
        return (
            <div id="detail">
                <Title>
                    {props.contact.first} {props.contact.last} | {SITE.title}
                </Title>
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
                            <form
                                action={routes.contacts.edit.href(
                                    { id: props.contact.id },
                                    { q: props.query },
                                )}
                                method="GET"
                            >
                                <Frame.Button rmx:target="detail" type="submit">
                                    Edit
                                </Frame.Button>
                            </form>
                            <DeleteButton contactId={props.contact.id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
