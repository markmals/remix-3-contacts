import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, navigate, on } from "remix/component";

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
    return (props: { contactId: string }) => (
        <form
            mix={on("submit", async event => {
                event.preventDefault();

                if (!confirm("Please confirm you want to delete this record.")) {
                    return;
                }

                await client.mutation(api.contacts.remove, { id: props.contactId as any });
                navigate(routes.home.href());
            })}
        >
            <button type="submit">Delete</button>
        </form>
    );
});
