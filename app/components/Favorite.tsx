import type { Id } from "#convex/_generated/dataModel.js";

import { mutate } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";

export function Favorite() {
    return (props: { contactId: string; favorite: boolean }) => (
        <form
            mix={mutate(api.contacts.toggleFavorite, {
                id: props.contactId as Id<"contacts">,
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
