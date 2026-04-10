import { convex } from "#/utils/convex.ts";
import { api } from "#convex/_generated/api.js";
import { on } from "remix/component";

export function Favorite() {
    return (props: { contactId: string; favorite: boolean }) => (
        <form
            mix={on("submit", async event => {
                event.preventDefault();
                await convex.client.mutation(api.contacts.toggleFavorite, {
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
}
