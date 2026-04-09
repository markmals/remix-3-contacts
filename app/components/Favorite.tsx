import { mutate } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry } from "remix/component";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

let ToggleFavoriteSchema = f.object({
    id: f.field(s.string()),
});

export let Favorite = clientEntry(import.meta.url, () => {
    return (props: { contactId: string; favorite: boolean }) => (
        <form
            mix={mutate({
                mutation: api.contacts.toggleFavorite,
                schema: ToggleFavoriteSchema as any,
            })}
        >
            <input name="id" type="hidden" value={props.contactId} />
            <button
                aria-label={props.favorite ? "Remove from favorites" : "Add to favorites"}
                type="submit"
            >
                {props.favorite ? "★" : "☆"}
            </button>
        </form>
    );
});
