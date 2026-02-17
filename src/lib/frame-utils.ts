import type { Handle } from "remix/component";
import { routes } from "~/routes.ts";

export function getFrameUrls(url: URL): [string, string] {
    const query = url.searchParams.get("q");

    let detail = routes.frame.zero.href(null, { q: query });
    let sidebar = routes.frame.sidebar.href(null, { q: query });

    const showMatch = routes.contacts.show.match(url);
    const editMatch = routes.contacts.edit.match(url);

    if (showMatch) {
        const id = showMatch.params.id;
        detail = routes.frame.show.href({ id }, { q: query });
        sidebar = routes.frame.sidebar.href(null, { q: query, selected: id });
    } else if (editMatch) {
        const id = editMatch.params.id;
        detail = routes.frame.edit.href({ id }, { q: query });
        sidebar = routes.frame.sidebar.href(null, { q: query, selected: id });
    }

    return [sidebar, detail];
}

export function isCanonicalPathname(url: URL): boolean {
    return (
        Boolean(routes.home.match(url)) ||
        Boolean(routes.contacts.show.match(url)) ||
        Boolean(routes.contacts.edit.match(url))
    );
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
