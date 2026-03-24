import { defineConfig } from "vite-plus";
import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix()],
    server: {
        port: 1612,
    },
    css: {
        transformer: "lightningcss",
    },
    resolve: {
        tsconfigPaths: true,
    },
    fmt: {
        printWidth: 100,
        tabWidth: 4,
        arrowParens: "avoid",
        organizeImports: true,
    },
    lint: {
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: ["eslint-plugin-perfectionist"],
        rules: {
            "typescript/no-floating-promises": "allow",
            "typescript/unbound-method": "allow",
            "perfectionist/sort-jsx-props": "warn",
        },
    },
});
