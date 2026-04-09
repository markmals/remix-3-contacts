import { run } from "remix/component";

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
