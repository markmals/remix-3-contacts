import { routes } from "#/routes.ts";
import { client } from "#/utils/convex.tsx";
import { api } from "#convex/_generated/api.js";
import { clientEntry, navigate, on } from "remix/component";

export let NewButton = clientEntry(import.meta.url, () => {
    return () => (
        <button
            mix={on("click", async () => {
                let id = await client.mutation(api.contacts.create, {
                    first: "",
                    last: "",
                    bsky: "",
                });
                navigate(routes.contacts.edit.href({ id }), {
                    target: "detail",
                });
            })}
            type="button"
        >
            New
        </button>
    );
});
