import { Document } from "#/components/Document.tsx";
import { ZeroState } from "#/components/ZeroState.tsx";
import { routes } from "#/routes.ts";
import { frameTarget } from "#/utils/frames.ts";
import { uploadStorage } from "#/utils/uploads.ts";
import { createFileResponse as sendFile } from "remix/response/file";
import { createController } from "remix/router";

import { sidebar } from "./sidebar.tsx";

export default createController(routes, {
    actions: {
        async home(ctx) {
            let target = frameTarget(ctx.headers);

            if (target === "sidebar") return sidebar(ctx);
            if (target === "detail") return ctx.render(<ZeroState />);

            return ctx.render(<Document />);
        },
        async uploads(ctx) {
            let file = await uploadStorage.get(ctx.params.key);

            if (!file) {
                return new Response("File not found", { status: 404 });
            }

            return sendFile(file, ctx.request, {
                cacheControl: "public, max-age=31536000",
            });
        },
    },
});
