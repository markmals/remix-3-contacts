import type { Handle } from "remix/ui";

import { routes } from "#/routes.ts";
import { RestfulForm } from "#/ui/restful-form.tsx";
import { clientEntry, on } from "remix/ui";

export let FavoriteButton = clientEntry(
    import.meta.url,
    (handle: Handle<{ contactId: number; favorite: boolean }>) => {
        let submitting = false;
        let favorite = handle.props.favorite;

        return () => {
            let props = handle.props;
            if (!submitting) {
                favorite = props.favorite;
            }

            return (
                <RestfulForm
                    action={routes.contacts.favorite.href({ id: props.contactId })}
                    method={routes.contacts.favorite.method}
                    mix={on("submit", async (event, signal) => {
                        event.preventDefault();

                        favorite = !favorite;
                        submitting = true;
                        await handle.update();

                        try {
                            let response = await fetch(event.currentTarget.action, {
                                method: event.currentTarget.method,
                                body: new FormData(event.currentTarget, event.submitter),
                                signal,
                            });

                            if (!response.ok && !response.redirected) {
                                throw response;
                            }

                            // The star renders in this frame and in the sidebar
                            // list, so refresh both rather than navigating: a
                            // navigation would touch history and reset scroll.
                            await Promise.all([
                                handle.frame.reload(),
                                handle.frames.get("sidebar")?.reload(),
                            ]);
                        } catch {
                            favorite = !favorite;
                        }

                        if (signal.aborted) return;
                        submitting = false;
                        handle.update();
                    })}
                >
                    <button
                        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                        name="favorite"
                        type="submit"
                        value={favorite ? "true" : "false"}
                    >
                        {favorite ? "★" : "☆"}
                    </button>
                </RestfulForm>
            );
        };
    },
);
