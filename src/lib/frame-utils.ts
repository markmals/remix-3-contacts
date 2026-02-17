import type { Handle } from "remix/component";
import { ArrayMatcher, type Match } from "remix/route-pattern";
import { routes } from "~/routes.ts";

type ContactRouteKind = "show" | "edit";
type CanonicalRouteKind = "home" | "show" | "edit";

const contactRouteMatcher = new ArrayMatcher<ContactRouteKind>();
const canonicalPathnameMatcher = new ArrayMatcher<CanonicalRouteKind>();

contactRouteMatcher.add(routes.contacts.show.pattern, "show");
contactRouteMatcher.add(routes.contacts.edit.pattern, "edit");

canonicalPathnameMatcher.add(routes.home.pattern, "home");
canonicalPathnameMatcher.add(routes.contacts.show.pattern, "show");
canonicalPathnameMatcher.add(routes.contacts.edit.pattern, "edit");

export function matchContactRoute(
    url: URL | string,
): { id: string; kind: ContactRouteKind } | null {
    const match = contactRouteMatcher.match(url) as Match<"/contacts/:id", ContactRouteKind>;

    if (!match) {
        return null;
    }

    const id = match.params.id;

    return { id, kind: match.data };
}

export function getFrameUrls(url: URL): [string, string] {
    const query = url.searchParams.get("q");

    let detail = routes.frame.zero.href(null, { q: query });
    let sidebar = routes.frame.sidebar.href(null, { q: query });

    const match = matchContactRoute(url);

    if (match) {
        const id = match.id;
        detail = routes.frame[match.kind].href({ id }, { q: query });
        sidebar = routes.frame.sidebar.href(null, {
            q: query,
            selected: id,
        });
    }

    return [sidebar, detail];
}

export function isCanonicalPathname(url: URL): boolean {
    return Boolean(canonicalPathnameMatcher.match(url));
}

export async function reloadFrames(handle: Handle<unknown>, url: URL): Promise<void> {
    const sidebar = handle.frames.get("sidebar");
    const detail = handle.frames.get("detail");

    if (!sidebar || !detail) {
        return;
    }

    const [sidebarPath, detailPath] = getFrameUrls(url);

    detail.src = detailPath;
    await detail.reload();

    sidebar.src = sidebarPath;
    await sidebar.reload();
}
