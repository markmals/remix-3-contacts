import { clientEntry, type Handle } from "remix/component";
import { routes } from "~/routes.ts";

export const DeleteConfirm = clientEntry(
    "/assets/DeleteConfirm.js#DeleteConfirm",
    function DeleteConfirm(handle: Handle) {
        let submitting = false;

        return (props: { contactId: string }) => (
            <form
                action={routes.contacts.destroy.href({ id: props.contactId })}
                method="POST"
                on={{
                    async submit(event) {
                        if (!confirm("Please confirm you want to delete this record.")) {
                            event.preventDefault();
                            return;
                        }

                        event.preventDefault();

                        submitting = true;
                        await handle.update();

                        await fetch(event.currentTarget.action, {
                            method: event.currentTarget.method,
                            body: new FormData(event.currentTarget),
                        });

                        await navigation.navigate(routes.home.href(), { history: "push" }).finished;

                        submitting = false;
                        await handle.update();
                    },
                }}
            >
                <input name="_method" type="hidden" value="DELETE" />
                <button disabled={submitting} type="submit">
                    Delete
                </button>
            </form>
        );
    },
);
