import { defineConfig } from "vite-plus";
import { remix } from "./remix.plugin.ts";

export default defineConfig({
    css: {
        transformer: "lightningcss",
    },
    resolve: {
        tsconfigPaths: true,
    },
    builder: {
        async buildApp(builder) {
            await builder.build(builder.environments.ssr);
            await builder.build(builder.environments.client);
        },
    },
    environments: {
        client: {
            build: {
                outDir: "dist/client",
                rollupOptions: {
                    input: "app/assets/entry",
                },
            },
        },
        ssr: {
            build: {
                outDir: "dist/ssr",
                rollupOptions: {
                    input: "app/entry.server",
                },
            },
        },
    },
    plugins: [remix()],
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
