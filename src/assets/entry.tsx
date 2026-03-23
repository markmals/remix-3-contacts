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
    async resolveFrame(src, signal) {
        const response = await fetch(src, { headers: { accept: "text/html" }, signal });
        return response.body ?? (await response.text());
    },
});
