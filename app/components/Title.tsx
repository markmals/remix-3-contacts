import { IS_SERVER } from "#/utils/server.ts";

export function Title() {
    return ({ children }: { children: string | string[] }) => {
        let title = Array.isArray(children) ? children.join("") : children;

        if (!IS_SERVER) {
            // Client title changes for when navigating on the client between frames.
            document.title = title;
        }

        // Always return the script element so server and client render output
        // matches during hydration. On the server, the script executes during
        // HTML parsing (sets title before JS loads). On the client, the existing
        // DOM node is reused by the hydrator — no re-execution.
        return <script>{`document.title=${JSON.stringify(title)}`}</script>;
    };
}
