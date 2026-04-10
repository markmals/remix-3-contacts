import { TypedEventTarget } from "remix/component";

export interface SearchEventMap {
    change: Event;
}

// Shared search state — SearchBar writes, SidebarList reads
export class Search extends TypedEventTarget<SearchEventMap> {
    query = "";

    update(q: string) {
        this.query = q;
        this.dispatchEvent(new Event("change"));
    }
}

export let search = new Search();
