import { search } from "#/utils/search.ts";
import { clientEntry, on } from "remix/component";

export let SearchBar = clientEntry(import.meta.url, () => {
    return (props: { query?: string }) => (
        <form id="search-form" method="GET">
            <input
                aria-label="Search contacts"
                defaultValue={props.query ?? undefined}
                id="q"
                mix={on("input", event => {
                    search.update(event.currentTarget.value.trim());
                })}
                name="q"
                placeholder="Search"
                type="search"
            />
            <div aria-hidden hidden id="search-spinner" />
            <div aria-live="polite" class="sr-only" />
        </form>
    );
});
