---
name: remix-file-uploads
description: >-
    Use when implementing file uploads, creating upload handlers for the formData
    middleware, validating uploaded files, storing files in R2 or other backends,
    serving uploaded files, building multipart forms, or handling the upload
    handler timing caveat with asyncContext.
---

# File Uploads

## Upload Handler

The `formData()` middleware accepts a custom `uploadHandler` that intercepts file fields during parsing. Return a **string** (typically a URL) that replaces the file in the parsed `FormData`.

```tsx
import type { FileUpload } from "remix/form-data-parser";

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
];

export async function uploadHandler(file: FileUpload): Promise<string> {
    if (!new Set(ALLOWED_TYPES).has(file.type)) {
        throw new Response(
            "Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP file.",
            { status: 415 },
        );
    }

    let ext = file.name.split(".").pop() || "jpg";
    let key = `${file.fieldName}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    await storage.set(key, file);

    return `/uploads/${key}`;
}
```

**Key details:**

- Receives a `FileUpload` object (a `File` with metadata) for every file field
- Validate file type early and throw a `Response` to short-circuit with an appropriate HTTP status
- Generate unique keys using field name + timestamp + random suffix to prevent collisions

## Wiring Into Middleware

```tsx
formData({ uploadHandler }),
```

Pass the handler to `formData()` in your middleware stack. Non-file fields are parsed normally; file fields are routed through the handler.

## Timing Caveat

The upload handler runs during form data parsing -- **before** `asyncContext()` and other middleware that follow `formData()` in the stack. This means `getContext()` is not available inside the handler. Access platform bindings (like R2 buckets) directly:

```tsx
import { env } from "cloudflare:workers";
let storage = new R2FileStorage(env.FILES);
```

See the remix-cloudflare skill for more on accessing bindings.

## Serving Uploaded Files

```tsx
import { createFileResponse as sendFile } from "remix/response/file";

export let serveUpload: BuildAction<"GET", typeof routes.uploads> = async ctx => {
    let storage = ctx.get(R2FileStorage);
    let file = await storage.get(ctx.params.key);

    if (!file) {
        return new Response("File not found", { status: 404 });
    }

    return sendFile(file, ctx.request, {
        cacheControl: "public, max-age=31536000",
    });
};
```

`createFileResponse` from `remix/response/file` serves files with proper headers (content type, range requests, caching). Use a long `cacheControl` lifetime for immutable uploads.

## Upload Route (Wildcard)

Use a wildcard route to match nested file keys:

```tsx
uploads: get("/uploads/*key"),
```

This matches paths like `/uploads/avatar/1712345678-abc123.jpg`, with the full path after `/uploads/` captured as `params.key`.

## Upload Form

```tsx
<RestfulForm
    action={routes.items.update.href({ id })}
    enctype="multipart/form-data"
    method={routes.items.update.method}
>
    <label>
        <span>Avatar</span>
        <div>
            <img alt="Current avatar" src={item.avatar || PLACEHOLDER_URL} />
            <label class="avatar-upload">
                <input accept={ALLOWED_TYPES.join(",")} hidden name="avatar" type="file" />
                <span>Choose Photo</span>
            </label>
        </div>
    </label>
    <button type="submit">Save</button>
</RestfulForm>
```

**Key rules:**

- `enctype="multipart/form-data"` is required -- without it the browser sends file fields as empty strings
- `accept` on the file input filters the file picker (client-side hint only -- always validate server-side too)
- Use a hidden file input with a styled label for custom upload button appearance

## Preserving Existing Files on Update

When no new file is uploaded, preserve the existing value:

```tsx
let updates = s.parse(UpdateSchema, ctx.get(FormData));

// Preserve existing avatar when no new file is uploaded
if (!updates.avatar) {
    updates.avatar = existingRecord.avatar ?? "";
}
```
