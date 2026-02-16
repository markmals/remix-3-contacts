import { clientEntry, type Handle } from "remix/component";
import { reloadFrames } from "~/lib/frame-utils.ts";
import { routes } from "~/routes.ts";

export const Favorite = clientEntry(
    "/assets/Favorite.js#Favorite",
    function Favorite(handle: Handle, setup: { favorite: boolean }) {
        let favorite = setup.favorite;

        return (props: { contactId: number }) => {
            return (
                <form
                    action={routes.contacts.favorite.href({ id: props.contactId })}
                    method="POST"
                    on={{
                        async submit(event) {
                            event.preventDefault();

                            favorite = !favorite;
                            const signal = await handle.update();

                            try {
                                const response = await fetch(event.currentTarget.action, {
                                    method: event.currentTarget.method,
                                    body: new FormData(event.currentTarget, event.submitter),
                                    signal,
                                });

                                if (!response.ok && !response.redirected) {
                                    favorite = !favorite;
                                }

                                const url = new URL(window.location.href);
                                await reloadFrames(handle, url);
                            } catch {
                                favorite = !favorite;
                                handle.update();
                            }
                        },
                    }}
                >
                    <input name="_method" type="hidden" value="PATCH" />
                    <input name="id" type="hidden" value={props.contactId} />
                    <button
                        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                        name="favorite"
                        type="submit"
                        value={favorite ? "true" : "false"}
                    >
                        {favorite ? "★" : "☆"}
                    </button>
                </form>
            );
        };
    },
);
