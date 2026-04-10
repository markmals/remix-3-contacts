import type { Id } from "#convex/_generated/dataModel.js";

import { routes } from "#/routes.ts";
import { mutate } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { navigate, on } from "remix/component";

export function CancelButton() {
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
}

export function DeleteButton() {
    return (props: { contactId: string }) => (
        <form
            mix={[
                mutate(api.contacts.remove, { id: props.contactId as Id<"contacts"> }),
                on(mutate.submit, event => {
                    if (!confirm("Please confirm you want to delete this record.")) {
                        event.preventDefault();
                    }
                }),
                on(mutate.success, () => {
                    navigate(routes.home.href());
                }),
            ]}
        >
            <button type="submit">Delete</button>
        </form>
    );
}
