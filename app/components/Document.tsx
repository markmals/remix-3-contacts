import type { Contact } from "#/data/contacts.ts";

import { SidebarList } from "#/components/SidebarList.tsx";
import { SITE } from "#/data/meta.ts";
import clientAssets from "#/entry.browser.ts?assets=client";
import serverAssets from "#/entry.server.tsx?assets=ssr";
import styles from "#/index.css?url";
import { Frame } from "#/utils/frame.tsx";
import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import { getContext } from "remix/async-context-middleware";

import { Title } from "./Title.tsx";

export function Document() {
    let { url } = getContext();
    let { css, js } = mergeAssets(clientAssets, serverAssets);

    return (props: { contacts: Contact[]; query?: string }) => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <Title>{SITE.title}</Title>

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
                        <SidebarList contacts={props.contacts} query={props.query} />
                    </div>
                    <Frame name="detail" url={url} />
                </div>
            </body>
        </html>
    );
}
