import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, on } from "remix/component";

export let Favorite = clientEntry(import.meta.url, () => {
    return (props: { contactId: string; favorite: boolean }) => (
        <form
            mix={on("submit", async event => {
                event.preventDefault();
                await client.mutation(api.contacts.toggleFavorite, {
                    id: props.contactId as any,
                });
            })}
        >
            <button
                aria-label={props.favorite ? "Remove from favorites" : "Add to favorites"}
                type="submit"
            >
                {props.favorite ? "★" : "☆"}
            </button>
        </form>
    );
});
