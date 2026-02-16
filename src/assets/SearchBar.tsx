import { clientEntry, type Handle } from "remix/component";

export const SearchBar = clientEntry(
    "/assets/SearchBar.js#SearchBar",
    function SearchBar(handle: Handle, setup: { query: string | null }) {
        let destinationUrl: URL | null = null;

        if (typeof window !== "undefined") {
            handle.on(navigation, {
                navigate(event) {
                    destinationUrl = new URL(event.destination.url);
                    handle.update();
                },
                navigatesuccess() {
                    destinationUrl = null;
                    handle.update();
                },
                navigateerror() {
                    destinationUrl = null;
                    handle.update();
                },
            });
        }

        return () => {
            const searching = Boolean(destinationUrl?.searchParams.has("q"));
            return (
                <form id="search-form" method="GET">
                    <input
                        aria-label="Search contacts"
                        class={searching ? "loading" : ""}
                        defaultValue={setup.query ?? undefined}
                        id="q"
                        name="q"
                        on={{
                            async input(event) {
                                const url = new URL(location.href);

                                // Remove empty query params when value is empty
                                if (!event.currentTarget.value) {
                                    url.searchParams.delete("q");
                                    navigation.navigate(url.toString());
                                    return;
                                }

                                const isFirstSearch = url.searchParams.get("q") === null;

                                // Performs a client-side navigation
                                url.searchParams.set("q", event.currentTarget.value);
                                navigation.navigate(url.toString(), {
                                    history: isFirstSearch ? "replace" : "auto",
                                });
                            },
                        }}
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
