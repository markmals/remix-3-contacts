import { clientEntry, type Handle } from "remix/component";

export const Search = clientEntry(
    "/assets/LiveSearch.js#LiveSearch",
    function Search(handle: Handle, setup: { query: string | null }) {
        let searching = false;
        let didSearch = Boolean(setup.query);

        return () => (
            <form id="search-form" method="GET">
                <input
                    aria-label="Search contacts"
                    class={searching ? "loading" : ""}
                    defaultValue={setup.query ?? undefined}
                    id="q"
                    name="q"
                    on={{
                        async input(event) {
                            if (typeof window === "undefined") {
                                return;
                            }

                            const value = event.currentTarget.value.trim();
                            const nextUrl = new URL(window.location.href);

                            if (value.length === 0) {
                                nextUrl.searchParams.delete("q");

                                searching = true;
                                await handle.update();

                                await window.navigation.navigate(nextUrl.toString(), {
                                    history: "push",
                                }).finished;

                                searching = false;
                                await handle.update();

                                didSearch = false;
                                return;
                            }

                            nextUrl.searchParams.set("q", value);

                            const history = didSearch ? "replace" : "push";
                            didSearch = true;

                            searching = true;
                            await handle.update();

                            await window.navigation.navigate(nextUrl.toString(), { history })
                                .finished;

                            searching = false;
                            await handle.update();
                        },
                    }}
                    placeholder="Search"
                    type="search"
                />
                <div aria-hidden hidden={!searching} id="search-spinner" />
                <div aria-live="polite" class="sr-only" />
            </form>
        );
    },
);
