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
                    let value = event.currentTarget.value.trim();
                    let url = new URL(location.href);

                    if (!value) {
                        url.searchParams.delete("q");
                    } else {
                        url.searchParams.set("q", value);
                    }

                    let isFirstSearch = !location.search.includes("q=") && value;
                    if (isFirstSearch) {
                        history.pushState(null, "", url.toString());
                    } else {
                        history.replaceState(null, "", url.toString());
                    }

                    // Notify SidebarList to re-filter
                    search.update(value);
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
