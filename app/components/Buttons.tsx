import { clientEntry, navigate, on } from "remix/component";
import { routes } from "~/routes.ts";

export function NewButton() {
    return () => (
        <form action={routes.contacts.create.href()} method="POST">
            <button type="submit">New</button>
        </form>
    );
}

export const EditButton = clientEntry(import.meta.url, () => {
    return (props: { contactId: number; query?: string }) => (
        <form
            action={routes.contacts.edit.href({ id: props.contactId }, { q: props.query })}
            method="GET"
            mix={on("submit", event => {
                event.preventDefault();
                navigate(event.currentTarget.action, { target: "detail" });
            })}
        >
            <button type="submit">Edit</button>
        </form>
    );
});

export const CancelButton = clientEntry(import.meta.url, () => {
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

export const DeleteButton = clientEntry(import.meta.url, () => {
    return (props: { contactId: number }) => (
        <form
            action={routes.contacts.destroy.href({ id: props.contactId })}
            method="POST"
            mix={on("submit", async event => {
                event.preventDefault();
                if (!confirm("Please confirm you want to delete this record.")) return;
                const response = await fetch(event.currentTarget.action, {
                    method: "POST",
                    body: new FormData(event.currentTarget, event.submitter),
                });
                navigate(response.url);
            })}
        >
            <input name="_method" type="hidden" value={routes.contacts.destroy.method} />
            <button type="submit">Delete</button>
        </form>
    );
});
