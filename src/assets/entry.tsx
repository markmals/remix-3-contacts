import { run } from "remix/component";

run(document, {
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
    async resolveFrame(src) {
        const response = await fetch(src, { headers: { accept: "text/html" } });
        return await response.text();
    },
});
