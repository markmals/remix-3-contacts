import { navigate, run } from "remix/component";

// Phase 1: Anchor frame targeting (before `run`)
// Anchors outside frames need explicit interception to resolve their
// rmx-target attribute, since the built-in run() listener only handles
// anchors inside frames.
navigation.addEventListener("navigate", event => {
    if (!event.canIntercept) return;
    if (!event.sourceElement) return;

    let anchor = event.sourceElement.closest("a, area") as HTMLElement | null;
    if (!anchor) return;

    let target = anchor.getAttribute("rmx-target") ?? undefined;
    let src = anchor.getAttribute("rmx-src") ?? undefined;
    let resetScroll = anchor.hasAttribute("rmx-reset-scroll") || undefined;

    // No frame attributes — let built-in handler deal with it
    if (!target && !src) return;

    event.preventDefault();
    navigate(event.destination.url, { target, src, resetScroll });
});

// Phase 2: Remix runtime
run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        let exported = mod[exportName];

        if (typeof exported !== "function") {
            throw new TypeError(
                `Expected export '${exportName}' from '${moduleUrl}' to be a function`,
            );
        }

        return exported;
    },
    async resolveFrame(src, signal, target) {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        let response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    },
});

// Set focusReset to prevent browser auto-reset on non-traverse navigations
navigation.addEventListener("navigate", event => {
    if (!event.canIntercept || event.defaultPrevented || event.navigationType === "traverse") {
        return;
    }

    event.intercept({ focusReset: "manual" });
});
