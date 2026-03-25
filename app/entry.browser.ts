import { navigate, run } from "remix/component";

// Must be registered before `run` so `event.preventDefault` works properly
//
// - Form submissions: GET via soft-navigate, utilizing the button[rmx-target] attribute
// - Form submissions: POST via fetch, then soft-navigate to the redirect URL
navigation.addEventListener("navigate", async event => {
    if (!event.canIntercept) return;

    // triggered programatically, handled by built-in listener
    if (!event.sourceElement) return;
    // anchors handled by built-in listener
    if (event.sourceElement?.closest("a, area")) return;

    // sourceElement is <button type="submit"> inside of form submissions
    const target = event.sourceElement?.getAttribute("rmx-target") ?? undefined;
    const src = event.sourceElement?.getAttribute("rmx-src") ?? undefined;
    const resetScroll = event.sourceElement?.hasAttribute("rmx-reset-scroll") ?? undefined;

    // Form POST submission
    if (event.formData) {
        event.intercept({
            focusReset: "manual",
            async handler() {
                const response = await fetch(event.destination.url, {
                    method: "POST",
                    body: event.formData,
                    signal: event.signal,
                });

                navigate(response.url, { target, src, resetScroll });
            },
        });
        return;
    }

    // Form GET submission
    event.preventDefault();
    navigate(event.destination.url, { target, src, resetScroll });
});

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

// Must be registered after `run` (last intercept() call wins for focusReset).
navigation.addEventListener("navigate", event => {
    // Only set focusReset for non-traverse navigations.
    // Traversals (back/forward) are handled by the built-in listener.
    if (!event.canIntercept || event.defaultPrevented || event.navigationType === "traverse") {
        return;
    }

    // Set focusReset to prevent browser auto-reset
    // Important for search bar behavior
    event.intercept({ focusReset: "manual" });
});
