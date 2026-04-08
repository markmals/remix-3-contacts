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

                            // Remove empty query params when value is empty
                            if (!event.currentTarget.value.trim()) {
                                url.searchParams.delete("q");
                                await navigate(url.toString(), { target: "sidebar" });
                                return;
                            }

                            let isFirstSearch = url.searchParams.get("q") === null;

                            url.searchParams.set("q", event.currentTarget.value);
                            await navigate(url.toString(), {
                                target: "sidebar",
                                history: isFirstSearch ? "replace" : "push",
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
