import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import clientAssets from "~/entry.browser.ts?assets=client";
import { SearchBar } from "~/components/SearchBar.tsx";
import serverAssets from "~/entry.server.tsx?assets=ssr";
import { QuerySchema } from "~/lib/schemas.ts";
import styles from "~/index.css?url";
import { routes } from "~/routes.ts";
import { SITE } from "~/lib/meta.ts";

export function Document() {
    let { url } = getContext();
    let { q } = s.parse(QuerySchema, url.searchParams);
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <title>{SITE.title}</title>

                <link href="/favicon-32.png" rel="icon" sizes="32x32" />
                <link href="/favicon-128.png" rel="icon" sizes="128x128" />
                <link href="/favicon-180.png" rel="icon" sizes="180x180" />
                <link href="/favicon-192.png" rel="icon" sizes="192x192" />
                <link href="/favicon-180.png" rel="apple-touch-icon" sizes="180x180" />

                <link href={styles} rel="stylesheet" />
                {css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}

                <script async src={clientAssets.entry} type="module" />
                {js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>
                <div id="root">
                    <div id="sidebar">
                        <h1>{SITE.title}</h1>
                        <div>
                            <SearchBar query={q} />
                            <form
                                action={routes.contacts.create.href()}
                                method={routes.contacts.create.method}
                            >
                                <button type="submit">New</button>
                            </form>
                        </div>
                        <Frame name="sidebar" src={url.toString()} />
                    </div>
                    <Frame name="detail" src={url.toString()} />
                </div>
            </body>
        </html>
    );
}
