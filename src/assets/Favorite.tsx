import { clientEntry, type Handle } from "remix/component";
import { reloadFrames } from "~/lib/navigation.ts";
import { routes } from "~/routes.ts";

export const Favorite = clientEntry(
    "/assets/Favorite.js#Favorite",
    function Favorite(handle: Handle, setup: { favorite: boolean }) {
        let favorite = setup.favorite;
        let submitting = false;

        return (props: { contactId: string }) => {
            const nextFavorite = favorite ? "false" : "true";

            return (
                <form
                    action={routes.contacts.show.href()}
                    method="post"
                    on={{
                        async submit(event) {
                            event.preventDefault();

                            submitting = true;
                            favorite = !favorite;
                            await handle.update();

                            try {
                                const response = await fetch(event.currentTarget.action, {
                                    method: "POST",
                                    body: new FormData(event.currentTarget),
                                    headers: { accept: "text/html" },
                                });

                                if (!response.ok && !response.redirected) {
                                    favorite = !favorite;
                                }

                                await reloadFrames(handle, new URL(window.location.href));
                            } catch {
                                favorite = !favorite;
                            }

                            submitting = false;
                            await handle.update();
                        },
                    }}
                >
                    <input name="_method" type="hidden" value="PUT" />
                    <input name="id" type="hidden" value={props.contactId} />
                    <input name="favorite" type="hidden" value={nextFavorite} />
                    <button
                        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                        disabled={submitting}
                        type="submit"
                        value={String(favorite)}
                    >
                        {favorite ? "★" : "☆"}
                    </button>
                </form>
            );
        };
    },
);
