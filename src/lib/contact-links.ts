import { routes } from "~/routes.ts";

function buildHref(pathname: string, params: URLSearchParams): string {
    const search = params.toString();

    if (!search) {
        return pathname;
    }

    return `${pathname}?${search}`;
}

export function buildShowHref(contactId: string, query: string | null): string {
    const params = new URLSearchParams();
    params.set("id", contactId);

    if (query) {
        params.set("q", query);
    }

    return buildHref(routes.contacts.show.href(), params);
}

export function buildEditHref(contactId: string, query: string | null): string {
    const params = new URLSearchParams();
    params.set("id", contactId);

    if (query) {
        params.set("q", query);
    }

    return buildHref(routes.contacts.edit.href(), params);
}
