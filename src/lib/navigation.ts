import type { Handle } from "remix/component";
import { routes } from "~/routes.ts";
import { buildDetailFrameSrc, buildSidebarFrameSrc } from "./frame-urls.ts";

export function isCanonicalPathname(pathname: string): boolean {
    return (
        pathname === routes.home.href() ||
        pathname === routes.contacts.show.href() ||
        pathname === routes.contacts.edit.href()
    );
}

export async function reloadFrames(handle: Handle, url: URL): Promise<void> {
    const sidebar = handle.frames.get("sidebar");
    const detail = handle.frames.get("detail");

    if (!sidebar || !detail) {
        return;
    }

    sidebar.src = buildSidebarFrameSrc(url);
    detail.src = buildDetailFrameSrc(url);

    await Promise.all([sidebar.reload(), detail.reload()]);
}
