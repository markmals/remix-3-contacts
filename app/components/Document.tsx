import { SearchBar } from "#/components/SearchBar.tsx";
import { SITE } from "#/data/meta.ts";
import { QuerySchema } from "#/data/schemas.ts";
import clientAssets from "#/entry.browser.tsx?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
import styles from "#/index.css?url";
import { routes } from "#/routes.ts";
import { Head } from "#/utils/metadata/index.ts";
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { Frame } from "remix/ui";

import { RestfulForm } from "./RestfulForm.tsx";

export function Document() {
    let { url } = getContext();
    let { q } = s.parse(QuerySchema, url.searchParams);
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />

                <link href="/favicon.ico" rel="icon" sizes="32x32" />
                <link href="/favicon.svg" rel="icon" sizes="any" type="image/svg+xml" />
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
                <Head>
                    <title>{SITE.title}</title>
                </Head>
                <div id="root">
                    <div id="sidebar">
                        <h1>{SITE.title}</h1>
                        <div>
                            <SearchBar query={q} />
                            <RestfulForm
                                action={routes.contacts.create.href()}
                                method={routes.contacts.create.method}
                            >
                                <button type="submit">New</button>
                            </RestfulForm>
                        </div>
                        <Frame name="sidebar" src={url.toString()} />
                    </div>
                    <Frame name="detail" src={url.toString()} />
                </div>
            </body>
        </html>
    );
}
