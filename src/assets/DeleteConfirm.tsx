import { clientEntry } from "remix/component";
import { routes } from "~/routes.ts";

export const DeleteConfirm = clientEntry(
    routes.assets.href({ file: "DeleteConfirm", component: "DeleteConfirm" }),
    function DeleteConfirm() {
        const route = routes.contacts.destroy;

        return (props: { contactId: number }) => (
            <form
                action={route.href({ id: props.contactId })}
                method="POST"
                on={{
                    async submit(event) {
                        if (!confirm("Please confirm you want to delete this record.")) {
                            event.preventDefault();
                        }
                    },
                }}
            >
                <input name="_method" type="hidden" value={route.method} />
                <button type="submit">Delete</button>
            </form>
        );
    },
);
