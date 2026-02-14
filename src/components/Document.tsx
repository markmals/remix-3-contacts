import { getContext } from "remix/async-context-middleware";
import { Frame } from "remix/component";
import { NavigationEnhancer } from "~/assets/NavigationEnhancer.tsx";
import { getFrameUrls } from "~/lib/frame-utils.ts";

export function Document() {
    const ctx = getContext();
    const url = new URL(ctx.request.url);
    const [sidebar, detail] = getFrameUrls(url);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <title>Remix 3 Contacts</title>
                <link href="/index.css" rel="stylesheet" />
                <link href="/favicon.ico" rel="icon" />
                <script async src="/assets/entry.js" type="module" />
            </head>
            <body>
                <div id="root">
                    <Frame name="sidebar" src={sidebar} />
                    <Frame name="detail" src={detail} />
                </div>
                <NavigationEnhancer />
            </body>
        </html>
    );
}
