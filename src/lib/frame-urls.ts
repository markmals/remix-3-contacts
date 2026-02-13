import { routes } from "~/routes.ts";

function buildFrameSrc(url: URL, framePath: string): string {
    const frameUrl = new URL(framePath, url.origin);
    const query = url.searchParams.get("q");
    const contactId = url.searchParams.get("id");

    if (query) {
        frameUrl.searchParams.set("q", query);
    }

    if (contactId) {
        frameUrl.searchParams.set("id", contactId);
    }

    return `${frameUrl.pathname}${frameUrl.search}`;
}

export function buildSidebarFrameSrc(url: URL): string {
    const frameUrl = new URL(routes.frame.sidebar.href(), url.origin);
    const query = url.searchParams.get("q");
    const contactId = url.searchParams.get("id");

    if (query) {
        frameUrl.searchParams.set("q", query);
    }

    if (contactId) {
        frameUrl.searchParams.set("id", contactId);
    }

    frameUrl.searchParams.set("path", url.pathname);

    return `${frameUrl.pathname}${frameUrl.search}`;
}

export function buildDetailFrameSrc(url: URL): string {
    if (url.pathname === routes.contacts.show.href()) {
        return buildFrameSrc(url, routes.frame.show.href());
    }

    if (url.pathname === routes.contacts.edit.href()) {
        return buildFrameSrc(url, routes.frame.edit.href());
    }

    return routes.frame.zero.href();
}
