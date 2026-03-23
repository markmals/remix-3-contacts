import { clientEntry, on } from "remix/component";
import { routes } from "~/routes.ts";

export const DeleteConfirm = clientEntry(
    routes.assets.href({ file: "DeleteConfirm", component: "DeleteConfirm" }),
    function DeleteConfirm() {
        const destroy = routes.contacts.destroy;

        return (props: { contactId: number }) => (
            <form
                action={destroy.href({ id: props.contactId })}
                method="POST"
                mix={[
                    on("submit", async event => {
                        if (!confirm("Please confirm you want to delete this record.")) {
                            event.preventDefault();
                        }
                    }),
                ]}
            >
                <input name="_method" type="hidden" value={destroy.method} />
                <button type="submit">Delete</button>
            </form>
        );
    },
);
