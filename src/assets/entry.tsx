import { run } from "remix/component";

run({
    async loadModule(moduleUrl, exportName) {
        const mod = await import(moduleUrl);
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

// Prevent the browser from auto-resetting focus on intercepted navigations.
// The built-in listener uses event.intercept() without focusReset: "manual",
// so the browser resets focus after each navigation by default. This listener
// runs after the built-in one (last intercept() call wins for focusReset).
navigation.addEventListener("navigate", event => {
    if (event.canIntercept) {
        event.intercept({ focusReset: "manual" });
    }
});
