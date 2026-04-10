import { navigating } from "#/utils/navigating.ts";
import { addEventListeners, clientEntry, navigate, on } from "remix/component";

export let SearchBar = clientEntry(import.meta.url, handle => {
    addEventListeners(navigating, handle.signal, {
        destinationchange() {
            handle.update();
        },
    });

    return (props: { query?: string }) => {
        let searching = Boolean(navigating.to.url?.searchParams.has("q"));

        return (
            <form id="search-form" method="GET">
                <input
                    aria-label="Search contacts"
                    class={searching ? "loading" : ""}
                    defaultValue={props.query ?? undefined}
                    id="q"
                    mix={on("input", async event => {
                        try {
                            let url = new URL(location.href);
                            let value = event.currentTarget.value.trim();

                            if (!value) {
                                url.searchParams.delete("q");
                            } else {
                                url.searchParams.set("q", value);
                            }

                            let isFirstSearch = !location.search.includes("q=") && value;
                            await navigate(url.toString(), {
                                history: isFirstSearch ? "push" : "replace",
                            });
                        } catch {
                            // ignore navigation errors caused by abortions during typing
                        }
                    })}
                    name="q"
                    placeholder="Search"
                    type="search"
                />
                <div aria-hidden hidden={!searching} id="search-spinner" />
                <div aria-live="polite" class="sr-only" />
            </form>
        );
    };
});
