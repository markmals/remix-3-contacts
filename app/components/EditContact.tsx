import type { Contact } from "#/data/contacts.ts";

import { CancelButton } from "#/components/Buttons.tsx";
import { SITE } from "#/data/meta.ts";
import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, navigate, on } from "remix/component";

import { Title } from "./Title.tsx";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];

export let EditContact = clientEntry(import.meta.url, () => {
    return (props: { contact: Contact }) => (
        <div id="detail">
            <Title>
                Edit {props.contact.first} {props.contact.last} | {SITE.title}
            </Title>
            <form
                id="contact-form"
                mix={on("submit", async event => {
                    event.preventDefault();

                    let form = new FormData(event.currentTarget);
                    let avatarFile = form.get("avatar") as File | null;
                    let avatarStorageId = props.contact.avatar;

                    // Upload new avatar if a file was selected
                    if (avatarFile && avatarFile.size > 0) {
                        if (!new Set(ALLOWED_TYPES).has(avatarFile.type)) {
                            alert(
                                "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
                            );
                            return;
                        }

                        let uploadUrl = await client.mutation(api.files.generateUploadUrl, {});
                        let response = await fetch(uploadUrl, {
                            method: "POST",
                            headers: { "Content-Type": avatarFile.type },
                            body: avatarFile,
                        });
                        let { storageId } = await response.json();
                        avatarStorageId = storageId;
                    }

                    await client.mutation(api.contacts.update, {
                        id: props.contact._id as any,
                        first: (form.get("first") as string) || "",
                        last: (form.get("last") as string) || "",
                        bsky: (form.get("bsky") as string) || "",
                        notes: (form.get("notes") as string) || "",
                        avatar: avatarStorageId,
                    });

                    navigate(routes.contacts.show.href({ id: props.contact._id }), {
                        target: "detail",
                    });
                })}
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
                                props.contact.avatarUrl ||
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
            </form>
        </div>
    );
});
