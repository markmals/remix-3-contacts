import type { Handle } from "remix/ui";

import { routes } from "#/routes.ts";
import { clientEntry, navigate, on } from "remix/ui";

import { RestfulForm } from "./RestfulForm.tsx";

export let Favorite = clientEntry(
    import.meta.url,
    (handle: Handle<{ contactId: number; favorite: boolean }>) => {
        let submitting = false;
        let favorite!: boolean;

        return () => {
            let props = handle.props;
            if (!submitting) {
                favorite = props.favorite;
            }

            return (
                <RestfulForm
                    action={routes.contacts.favorite.href({ id: props.contactId })}
                    method={routes.contacts.favorite.method}
                    mix={on("submit", async event => {
                        event.preventDefault();

                        favorite = !favorite;
                        submitting = true;
                        let signal = await handle.update();

                        try {
                            let response = await fetch(event.currentTarget.action, {
                                method: event.currentTarget.method,
                                body: new FormData(event.currentTarget, event.submitter),
                                signal,
                            });

                            if (!response.ok && !response.redirected) {
                                throw response;
                            }

                            submitting = false;
                            navigate(location.href, { history: "replace" });
                        } catch {
                            favorite = !favorite;
                            submitting = false;
                            handle.update();
                        }
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
