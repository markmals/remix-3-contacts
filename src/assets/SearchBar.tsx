import { addEventListeners, clientEntry, type Handle, on } from "remix/component";
import { navigating } from "~/lib/navigation.ts";
import { routes } from "~/routes.ts";

export const SearchBar = clientEntry(
    routes.assets.href({ file: "SearchBar", component: "SearchBar" }),
    function SearchBar(handle: Handle, setup: { query: string | null }) {
        addEventListeners(navigating, handle.signal, {
            destinationchange() {
                handle.update();
            },
        });

        return () => {
            const searching = Boolean(navigating.to.url?.searchParams.has("q"));
            return (
                <form id="search-form" method="GET">
                    <input
                        aria-label="Search contacts"
                        class={searching ? "loading" : ""}
                        defaultValue={setup.query ?? undefined}
                        id="q"
                        mix={on("input", async event => {
                            const url = new URL(location.href);

                            // Remove empty query params when value is empty
                            if (!event.currentTarget.value.trim()) {
                                url.searchParams.delete("q");
                                navigation.navigate(url.toString());
                                return;
                            }

                            const isFirstSearch = url.searchParams.get("q") === null;

                            url.searchParams.set("q", event.currentTarget.value);
                            navigation.navigate(url.toString(), {
                                history: isFirstSearch ? "replace" : "auto",
                            });
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
    },
);
