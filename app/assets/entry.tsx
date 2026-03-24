import { navigate, run } from "remix/component";

run({
    async loadModule(moduleUrl, exportName) {
        const mod = await import(/* @vite-ignore */ moduleUrl);
        const exported = mod[exportName];

        if (typeof exported !== "function") {
            throw new TypeError(
                `Expected export '${exportName}' from '${moduleUrl}' to be a function`,
            );
        }

        return exported;
    },
    async resolveFrame(src, signal, target) {
        const headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        const response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    },
});

// Runs after the built-in listener (last intercept() call wins for focusReset).
// - GET navigations: just set focusReset to prevent browser auto-reset
// - Form submissions: POST via fetch, then soft-navigate to the redirect URL
navigation.addEventListener("navigate", event => {
    if (!event.canIntercept) return;

    if (event.formData) {
        event.intercept({
            focusReset: "manual",
            async handler() {
                const response = await fetch(event.destination.url, {
                    method: "POST",
                    body: event.formData,
                    signal: event.signal,
                });
                navigate(response.url);
            },
        });
        return;
    }

    // Only set focusReset for non-traverse navigations.
    // Traversals (back/forward) are handled by the built-in listener.
    if (event.navigationType !== "traverse") {
        event.intercept({ focusReset: "manual" });
    }
});
