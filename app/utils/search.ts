import { TypedEventTarget } from "remix/component";

export interface SearchEventMap {
    change: Event;
}

// Shared search state — SearchBar writes, SidebarList reads.
// Updates the URL via History API (not Navigation API) to avoid
// triggering run()'s frame reconciliation.
export class Search extends TypedEventTarget<SearchEventMap> {
    query = "";

    update(q: string) {
        this.query = q;

        let url = new URL(location.href);
        if (!q) {
            url.searchParams.delete("q");
        } else {
            url.searchParams.set("q", q);
        }

        let isFirstSearch = !location.search.includes("q=") && q;
        if (isFirstSearch) {
            history.pushState(null, "", url.toString());
        } else {
            history.replaceState(null, "", url.toString());
        }

        this.dispatchEvent(new Event("change"));
    }
}

export let search = new Search();
