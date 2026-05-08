import type { Contact } from "#/data/contacts.ts";

import { DeleteButton } from "#/components/Buttons.tsx";
import { Favorite } from "#/components/Favorite.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { link } from "#/utils/link.tsx";
import { Head } from "#/utils/metadata/index.ts";

import { RestfulForm } from "./RestfulForm.tsx";

function contactName(contact: Contact): string {
    let name = `${contact.first ?? ""} ${contact.last ?? ""}`.trim();
    return name || "No Name";
}

const AVATAR_PLACEHOLDER =
    "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

export function ShowContact() {
    return (props: { contact: Contact; query?: string }) => {
        let name = contactName(props.contact);
        let description = props.contact.notes || (props.contact.bsky ? `@${props.contact.bsky}` : "");

        return (
            <div id="detail">
                <Head>
                    <title>{`${name} · ${SITE.title}`}</title>
                    {description ? <meta content={description} name="description" /> : null}
                </Head>
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
                            <RestfulForm
                                action={routes.contacts.edit.href(
                                    { id: props.contact.id },
                                    { q: props.query },
                                )}
                                method={routes.contacts.edit.method}
                            >
                                <button mix={link({ target: "detail" })} type="submit">
                                    Edit
                                </button>
                            </RestfulForm>
                            <DeleteButton contactId={props.contact.id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
