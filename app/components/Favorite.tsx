import { clientEntry, navigate, on } from "remix/component";
import { routes } from "~/routes.ts";

export let Favorite = clientEntry(import.meta.url, handle => {
    let submitting = false;
    let favorite!: boolean;

    return (props: { contactId: number; favorite: boolean }) => {
        if (!submitting) {
            favorite = props.favorite;
        }

        return (
            <form
                action={routes.contacts.favorite.href({ id: props.contactId })}
                method="POST"
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
                <input name="_method" type="hidden" value={routes.contacts.favorite.method} />
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
});
