import type { Handle } from "remix/component";
import { routes } from "~/routes.ts";
import { Matcher } from "./matcher.ts";

export const frames = {
    detail({ for: url }: { for: URL }) {
        const search = { q: url.searchParams.get("q") };
        const match = Matcher.shared.match(url);
        return match
            ? routes.frame[match.kind].href({ id: match.id }, search)
            : routes.frame.zero.href(null, search);
    },
    sidebar({ for: url }: { for: URL }) {
        const search = { q: url.searchParams.get("q") };
        const match = Matcher.shared.match(url);
        return match
            ? routes.frame.sidebar.href(null, {
                  ...search,
                  selected: match.id,
              })
            : routes.frame.sidebar.href(null, search);
    },
    async reload({ for: url }: { for: URL }, handle: Handle<unknown>) {
        const sidebar = handle.frames.get("sidebar");
        const detail = handle.frames.get("detail");

        if (!sidebar || !detail) {
            return;
        }

        const detailPath = this.detail({ for: url });
        detail.src = detailPath;
        await detail.reload();

        const sidebarPath = this.sidebar({ for: url });
        sidebar.src = sidebarPath;
        await sidebar.reload();
    },
};
