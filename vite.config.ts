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
    run: {
        tasks: {
            typecheck: {
                command: "tsgo --noEmit",
            },
        },
    },
});
