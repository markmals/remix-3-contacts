import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import { NavigationEnhancer } from "~/assets/NavigationEnhancer.tsx";
import { SearchBar } from "~/assets/SearchBar.tsx";
import { getFrameUrls } from "~/lib/frame-utils.ts";
import { routes } from "~/routes.ts";

export function Document() {
    const ctx = getContext();
    const query = ctx.url.searchParams.get("q");
    const [sidebar, detail] = getFrameUrls(ctx.url);

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
                            <SearchBar setup={{ query }} />
                            <form action={routes.contacts.create.href()} method="post">
                                <button type="submit">New</button>
                            </form>
                        </div>
                        <Frame name="sidebar" src={sidebar} />
                    </div>
                    <Frame name="detail" src={detail} />
                </div>
                <NavigationEnhancer />
            </body>
        </html>
    );
}
