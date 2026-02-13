import { clientEntry, type Handle } from "remix/component";
import { routes } from "~/routes.ts";

export const DeleteConfirm = clientEntry(
    "/assets/DeleteConfirm.js#DeleteConfirm",
    function DeleteConfirm(handle: Handle) {
        let submitting = false;

        return (props: { contactId: string }) => (
            <form
                action={routes.contacts.show.href()}
                method="post"
                on={{
                    async submit(event) {
                        if (!window.confirm("Please confirm you want to delete this record.")) {
                            event.preventDefault();
                            return;
                        }

                        event.preventDefault();

                        submitting = true;
                        await handle.update();

                        await fetch(event.currentTarget.action, {
                            method: "POST",
                            body: new FormData(event.currentTarget),
                            headers: { accept: "text/html" },
                        });

                        await window.navigation.navigate(routes.home.href(), { history: "push" })
                            .finished;

                        submitting = false;
                        await handle.update();
                    },
                }}
            >
                <input name="_method" type="hidden" value="DELETE" />
                <input name="id" type="hidden" value={props.contactId} />
                <button disabled={submitting} type="submit">
                    Delete
                </button>
            </form>
        );
    },
);
