import { clientEntry, navigate, on } from "remix/component";
import { routes } from "~/routes.ts";

export const NewButton = clientEntry(
    routes.assets.href({ file: "Buttons", component: "NewButton" }),
    function NewButton() {
        return () => (
            <form
                action={routes.contacts.create.href()}
                method="POST"
                mix={on("submit", async event => {
                    event.preventDefault();
                    const response = await fetch(event.currentTarget.action, {
                        method: "POST",
                    });
                    navigate(response.url);
                })}
            >
                <button type="submit">New</button>
            </form>
        );
    },
);

export const EditButton = clientEntry(
    routes.assets.href({ file: "Buttons", component: "EditButton" }),
    function EditButton() {
        return (props: { contactId: number; query: string | null }) => (
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
    },
);

export const CancelButton = clientEntry(
    routes.assets.href({ file: "Buttons", component: "CancelButton" }),
    function CancelButton() {
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
    },
);

export const DeleteButton = clientEntry(
    routes.assets.href({ file: "Buttons", component: "DeleteButton" }),
    function DeleteButton() {
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
    },
);
