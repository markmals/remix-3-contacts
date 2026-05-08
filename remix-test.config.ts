import type { RemixTestConfig } from "remix/test";

export default {
    glob: {
        test: "app/**/*.test.{ts,tsx}",
        browser: "app/**/*.test.{ts,tsx}",
    },
    playwrightConfig: {
        projects: [
            {
                name: "chromium",
                use: { browserName: "chromium" },
            },
        ],
    },
} satisfies RemixTestConfig;
