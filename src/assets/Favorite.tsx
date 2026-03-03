import { clientEntry, type Handle } from "remix/component";
import { routes } from "~/routes.ts";

export const Favorite = clientEntry(
    routes.assets.href({ file: "Favorite", component: "Favorite" }),
    function Favorite(handle: Handle) {
        const route = routes.contacts.favorite;
        let submitting = false;
        let favorite!: boolean;

        return (props: { contactId: number; favorite: boolean }) => {
            if (!submitting) {
                favorite = props.favorite;
            }

            return (
                <form
                    action={route.href({ id: props.contactId })}
                    method="POST"
                    on={{
                        async submit(event) {
                            event.preventDefault();

                            favorite = !favorite;
                            submitting = true;
                            const signal = await handle.update();

                            try {
                                const response = await fetch(event.currentTarget.action, {
                                    method: event.currentTarget.method,
                                    body: new FormData(event.currentTarget, event.submitter),
                                    signal,
                                });

                                if (!response.ok && !response.redirected) {
                                    throw response;
                                }

                                submitting = false;
                                navigation.reload();
                            } catch {
                                favorite = !favorite;
                                submitting = false;
                                handle.update();
                            }
                        },
                    }}
                >
                    <input name="_method" type="hidden" value={route.method} />
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
