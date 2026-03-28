import { clientEntry } from "remix/component";

import { isServer } from "~/lib/navigating.ts";

export let Title = clientEntry(import.meta.url, () => {
    return ({ children }: { children: string | string[] }) => {
        let title = Array.isArray(children) ? children.join("") : children;

        if (isServer) {
            // Inline script sets document.title during HTML parsing, before
            // hydration JS loads, eliminating the flash of the default title.
            return <script>{`document.title=${JSON.stringify(title)}`}</script>;
        } else {
            // Client title changes for when navigating on the client between frames.
            document.title = title;
        }
    };
});
