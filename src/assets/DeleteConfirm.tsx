import { clientEntry } from "remix/component";
import { routes } from "~/routes.ts";

export const DeleteConfirm = clientEntry(
    "/assets/DeleteConfirm.js#DeleteConfirm",
    function DeleteConfirm() {
        return (props: { contactId: number }) => (
            <form
                action={routes.contacts.destroy.href({ id: props.contactId })}
                method="POST"
                on={{
                    async submit(event) {
                        if (!confirm("Please confirm you want to delete this record.")) {
                            event.preventDefault();
                        }
                    },
                }}
            >
                <input name="_method" type="hidden" value="DELETE" />
                <button type="submit">Delete</button>
            </form>
        );
    },
);
