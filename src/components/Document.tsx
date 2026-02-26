import assert from "node:assert";
import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import { Navigator } from "~/assets/Navigator.tsx";
import { SearchBar } from "~/assets/SearchBar.tsx";
import { frames } from "~/frames.ts";
import { routes } from "~/routes.ts";

export function Document() {
    const { url } = getContext();

    // Resolve frame sources using frame router
    const sidebarSrc = frames.resolve.sidebar(url);
    const detailSrc = frames.resolve.detail(url);

    assert(sidebarSrc);
    assert(detailSrc);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <title>Remix 3 Contacts</title>
                <link href="/index.css" rel="stylesheet" />
                <link href="/favicon-32.png" rel="icon" sizes="32x32" />
                <link href="/favicon-128.png" rel="icon" sizes="128x128" />
                <link href="/favicon-180.png" rel="icon" sizes="180x180" />
                <link href="/favicon-192.png" rel="icon" sizes="192x192" />
                <link href="/favicon-180.png" rel="apple-touch-icon" sizes="180x180" />
                <script async src="/assets/entry.js" type="module" />
            </head>
            <body>
                <div id="root">
                    <div id="sidebar">
                        <h1>Remix 3 Contacts</h1>
                        <div>
                            <SearchBar setup={{ query: url.searchParams.get("q") }} />
                            <form
                                action={routes.contacts.create.href()}
                                method={routes.contacts.create.method}
                            >
                                <button type="submit">New</button>
                            </form>
                        </div>
                        <Frame name="sidebar" src={sidebarSrc} />
                    </div>
                    <Frame name="detail" src={detailSrc} />
                </div>
                <Navigator />
            </body>
        </html>
    );
}
