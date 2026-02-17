import { ArrayMatcher, type Match } from "remix/route-pattern";
import { routes } from "~/routes.ts";

export namespace Matcher {
    export type ContactRouteKind = "show" | "edit";
    export type CanonicalRouteKind = "home" | "show" | "edit";
}

export class Matcher {
    static shared = new Matcher();

    #contact = new ArrayMatcher<Matcher.ContactRouteKind>();
    canonical = new ArrayMatcher<Matcher.CanonicalRouteKind>();

    constructor() {
        this.#contact.add(routes.contacts.show.pattern, "show");
        this.#contact.add(routes.contacts.edit.pattern, "edit");

        this.canonical.add(routes.home.pattern, "home");
        this.canonical.add(routes.contacts.show.pattern, "show");
        this.canonical.add(routes.contacts.edit.pattern, "edit");
    }

    match(url: URL | string): { id: string; kind: Matcher.ContactRouteKind } | null {
        const match = this.#contact.match(url) as Match<"/contacts/:id", Matcher.ContactRouteKind>;

        if (!match) {
            return null;
        }

        const id = match.params.id;

        return { id, kind: match.data };
    }
}
