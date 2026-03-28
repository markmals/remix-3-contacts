import { clientEntry, on } from "remix/component";

import { routes } from "~/routes.ts";

export let CancelButton = clientEntry(import.meta.url, () => {
    return () => (
        <button
            mix={on("click", () => {
                navigation.back();
            })}
            type="button"
        >
            Cancel
        </button>
    );
});

export let DeleteButton = clientEntry(import.meta.url, () => {
    return (props: { contactId: number }) => (
        <form
            action={routes.contacts.destroy.href({ id: props.contactId })}
            method="POST"
            mix={on("submit", async event => {
                if (!confirm("Please confirm you want to delete this record.")) {
                    event.preventDefault();
                }
            })}
        >
            <input name="_method" type="hidden" value={routes.contacts.destroy.method} />
            <button type="submit">Delete</button>
        </form>
    );
});
