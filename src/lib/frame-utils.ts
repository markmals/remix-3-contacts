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

export function isCanonicalPathname(pathname: string): boolean {
    return (
        Boolean(routes.home.match(pathname)) ||
        Boolean(routes.contacts.show.match(pathname)) ||
        Boolean(routes.contacts.edit.match(pathname))
    );
}

export async function reloadFrames(handle: Handle<unknown>, url: URL): Promise<void> {
    const sidebar = handle.frames.get("sidebar");
    const detail = handle.frames.get("detail");

    if (!sidebar || !detail) {
        return;
    }

    const [sidebarPath, detailPath] = getFrameUrls(url);

    sidebar.src = sidebarPath;
    detail.src = detailPath;

    await Promise.all([sidebar.reload(), detail.reload()]);
}
