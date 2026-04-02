import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix({ serverHandler: false }), cloudflare({ viteEnvironment: { name: "ssr" } })],
    server: {
        port: 1612,
    },
    css: {
        transformer: "lightningcss",
    },
    resolve: {
        tsconfigPaths: true,
    },
    run: {
        tasks: {
            deploy: {
                command: "wrangler deploy",
            },
            typegen: {
                command: "wrangler types",
            },
            typecheck: {
                dependsOn: ["typegen"],
                command: "tsgo --noEmit",
            },
            check: {
                dependsOn: ["typegen"],
                command: "vp check --fix",
            },
        },
    },
    fmt: {
        ignorePatterns: ["**/worker-configuration.d.ts", "dist/**"],
        printWidth: 100,
        tabWidth: 4,
        arrowParens: "avoid",
        sortPackageJson: true,
        sortImports: {
            groups: [
                "type-import",
                ["value-builtin", "value-external"],
                "type-internal",
                "value-internal",
                ["type-parent", "type-sibling", "type-index"],
                ["value-parent", "value-sibling", "value-index"],
                "unknown",
            ],
            partitionByComment: true,
        },
        overrides: [
            {
                files: ["**/*.jsonc"],
                options: {
                    trailingComma: "none",
                },
            },
            {
                files: ["**/.vscode/**"],
                options: {
                    trailingComma: "all",
                },
            },
        ],
    },
    lint: {
        ignorePatterns: ["**/worker-configuration.d.ts", "dist/**"],
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
