import type { Handle } from "remix/component";
import { routes } from "~/routes.ts";
import { Matcher } from "./matcher.ts";

export function getFrameUrls(url: URL): [string, string] {
    const query = url.searchParams.get("q");

    let detail = routes.frame.zero.href(null, { q: query });
    let sidebar = routes.frame.sidebar.href(null, { q: query });

    const match = Matcher.shared.match(url);

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
    return Boolean(Matcher.shared.canonical.match(url));
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
