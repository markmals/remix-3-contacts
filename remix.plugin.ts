import fullstack from "@hiogawa/vite-plugin-fullstack";
import type { Program } from "oxc-parser";
import { parseSync } from "oxc-parser";
import type { PluginOption } from "vite-plus";

const CLIENT_ENTRY_PATTERN = /\bclientEntry\b/;

// Rolldown may provide ast and magicString on the transform hook meta at build time,
// but they are not available during dev.
interface RolldownTransformMeta {
    ast: Program;
    magicString: {
        [key: string]: unknown;
        prepend(str: string): void;
        overwrite(start: number, end: number, content: string): void;
    };
}

export function remix({
    serverEnvironments: _environments = ["ssr"],
    serverHandler = true,
}: {
    serverEnvironments?: string[];
    serverHandler?: boolean;
} = {}): PluginOption {
    let environments = new Set(_environments);

    return [
        fullstack({
            serverEnvironments: _environments,
            serverHandler,
        }),
        {
            name: "remix-build",
            async buildApp(builder) {
                await builder.build(builder.environments.ssr);
                await builder.build(builder.environments.client);
            },
            config() {
                return {
                    environments: {
                        client: {
                            build: {
                                outDir: "dist/client",
                                rollupOptions: {
                                    input: "app/entry.browser",
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
                };
            },
        },
        {
            name: "remix-preview-server",
            async configurePreviewServer(server) {
                let ssrOutDir = server.config.environments.ssr?.build?.outDir ?? "dist/ssr";
                let entryPath = new URL(
                    `${ssrOutDir}/entry.server.js`,
                    `file://${server.config.root}/`,
                ).href;

                let mod = await import(/* @vite-ignore */ entryPath);
                let router = mod.default ?? mod.router;

                let { createRequestListener } = await import("remix/node-fetch-server");

                return () => {
                    server.middlewares.use(
                        createRequestListener((request: Request) => router.fetch(request)),
                    );
                };
            },
        },
        {
            // Suppress abort errors from client disconnects (e.g. search-as-you-type)
            // that would otherwise trigger Vite's error overlay.
            name: "remix-suppress-abort-errors",
            configureServer(server) {
                return () => {
                    server.middlewares.use(
                        // @ts-expect-error - connect error handler requires 4 args
                        (err, _req, _res, next) => {
                            if (err?.message === "aborted") return;
                            next(err);
                        },
                    );
                };
            },
        },
        {
            name: "remix-client-entry-transform",
            transform: {
                filter: {
                    code: {
                        include: CLIENT_ENTRY_PATTERN,
                    },
                },
                handler(code, id, _meta) {
                    if (!code.includes("import.meta.url")) return;

                    let meta = _meta as unknown as Partial<RolldownTransformMeta> | undefined;
                    let ast = meta?.ast ?? parseSync(id, code).program;

                    let calls = findClientEntryCalls(ast);
                    if (calls.length === 0) return;

                    let isServer = environments.has(this.environment.name);

                    if (isServer) {
                        // Server: import ?assets=client to get the resolved client entry URL
                        let prepend = `import ___clientEntryAssets from "${id}?assets=client";\n`;

                        if (meta?.magicString) {
                            let { magicString } = meta;
                            magicString.prepend(prepend);
                            for (let call of calls) {
                                magicString.overwrite(
                                    call.metaUrlStart,
                                    call.metaUrlEnd,
                                    `___clientEntryAssets.entry + "#${call.exportName}"`,
                                );
                            }
                            return { code: magicString as unknown as string };
                        }

                        let result = code;
                        for (let call of [...calls].reverse()) {
                            result =
                                result.slice(0, call.metaUrlStart) +
                                `___clientEntryAssets.entry + "#${call.exportName}"` +
                                result.slice(call.metaUrlEnd);
                        }
                        return prepend + result;
                    }

                    // Client: import.meta.url already resolves to the chunk URL.
                    // Just append #ExportName so clientEntry gets the required fragment.
                    let result = code;
                    for (let call of [...calls].reverse()) {
                        result =
                            result.slice(0, call.metaUrlStart) +
                            `import.meta.url + "#${call.exportName}"` +
                            result.slice(call.metaUrlEnd);
                    }
                    return result;
                },
            },
        },
    ];
}

interface ClientEntryCall {
    exportName: string;
    metaUrlStart: number;
    metaUrlEnd: number;
}

function findClientEntryCalls(program: Program): ClientEntryCall[] {
    let results: ClientEntryCall[] = [];

    for (let node of program.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        if (node.declaration?.type !== "VariableDeclaration") continue;

        for (let declarator of node.declaration.declarations) {
            if (declarator.id.type !== "Identifier") continue;
            if (declarator.init?.type !== "CallExpression") continue;

            let call = declarator.init;

            if (call.callee.type !== "Identifier" || call.callee.name !== "clientEntry") continue;

            if (call.arguments.length < 2) continue;

            let firstArg = call.arguments[0];
            if (
                firstArg.type !== "MemberExpression" ||
                firstArg.object.type !== "MetaProperty" ||
                firstArg.property.type !== "Identifier" ||
                firstArg.property.name !== "url"
            )
                continue;

            results.push({
                exportName: declarator.id.name,
                metaUrlStart: firstArg.start,
                metaUrlEnd: firstArg.end,
            });
        }
    }

    return results;
}
