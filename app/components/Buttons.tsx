import type { Handle } from "remix/ui";

import { routes } from "#/routes.ts";
import { clientEntry, on } from "remix/ui";

import { RestfulForm } from "./RestfulForm.tsx";

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

export let DeleteButton = clientEntry(import.meta.url, (handle: Handle<{ contactId: number }>) => {
    return () => (
        <RestfulForm
            action={routes.contacts.destroy.href({ id: handle.props.contactId })}
            method={routes.contacts.destroy.method}
            mix={on("submit", async event => {
                if (!confirm("Please confirm you want to delete this record.")) {
                    event.preventDefault();
                }
            })}
        >
            <button type="submit">Delete</button>
        </RestfulForm>
    );
});
