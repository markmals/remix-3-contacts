import { Frame, type Handle } from "remix/component";
import { NavigationEnhancer } from "~/assets/NavigationEnhancer.tsx";
import { buildDetailFrameSrc, buildSidebarFrameSrc } from "~/lib/frame-urls.ts";

export function Document(_handle: Handle, setup: { url: URL }) {
    const sidebarSrc = buildSidebarFrameSrc(setup.url);
    const detailSrc = buildDetailFrameSrc(setup.url);

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
                    <Frame name="sidebar" src={sidebarSrc} />
                    <Frame name="detail" src={detailSrc} />
                </div>
                <NavigationEnhancer />
            </body>
        </html>
    );
}
