---
name: remix-sessions
description: >-
  Use when setting up session middleware, creating signed cookies, reading or
  writing session data, implementing flash messages, choosing a session storage
  strategy (cookie, filesystem, memory), rotating cookie secrets, regenerating
  session IDs, or destroying sessions on logout.
---

# Sessions and Cookies

## Middleware Setup

Wire sessions into the router with three pieces: a signed cookie, a storage strategy, and the `session()` middleware.

```tsx
import { createCookie } from "remix/cookie";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createCookieSessionStorage } from "remix/session/cookie-storage";

// 1. Create a signed cookie (secrets are required)
let sessionCookie = createCookie("__session", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    secrets: [env.SESSION_SECRET],
});

// 2. Choose a storage strategy
let sessionStorage = createCookieSessionStorage();

// 3. Add the middleware to your router
let router = createRouter({
    middleware: [
        // ... other middleware
        session(sessionCookie, sessionStorage),
    ],
});
```

The middleware reads the session from the cookie on each request, makes it available as `context.get(Session)`, and automatically saves changes and sets the response cookie.

## Reading and Writing Session Data

```tsx
router.map(routes.user, {
    actions: {
        // POST
        preferences(context) {
            let session = context.get(Session);
            let { theme } = s.parse(ThemeSchema, context.get(FormData));
            session.set("theme", theme);
            return redirect(routes.user.settings.href());
        },
        // GET
        settings(context) {
            let session = context.get(Session);
            let theme = session.get("theme") ?? "system";
            return frame(<Settings theme={theme} />);
        },
    },
});
```

## Flash Messages

Flash values persist for exactly one request, then are automatically cleared. Use for success/error notifications after form submissions.

```tsx
// In the action -- set the flash
async create(context) {
    let contact = await createContact(context.get(FormData));
    let session = context.get(Session);
    session.flash("message", `Created ${contact.name}`);
    return redirect(routes.contacts.show.href({ id: contact.id }));
},

// In the next request -- read and display it
async show(context) {
    let session = context.get(Session);
    let flash = session.get("message"); // Available once, then gone
    let contact = await getContact(context.params.id);
    return frame(<ContactDetail contact={contact} flash={flash} />);
},
```

## Storage Strategies

| Strategy           | Import                         | Best for                                             |
| ------------------ | ------------------------------ | ---------------------------------------------------- |
| Cookie storage     | `remix/session/cookie-storage` | Small session data (< 4KB), no server storage needed |
| Filesystem storage | `remix/session/fs-storage`     | Production servers with persistent disk              |
| Memory storage     | `remix/session/memory-storage` | Development and testing only                         |

## Cookie Security

- Always provide `secrets` -- session cookies must be signed to prevent tampering
- Use `httpOnly: true` to prevent client-side JavaScript access
- Use `secure: true` in production (HTTPS only)
- Use `sameSite: "lax"` to prevent CSRF on cross-site requests
- Never manipulate `document.cookie` directly -- use Remix's cookie utilities

## Secret Rotation

Add the new secret to the beginning of the array. Existing cookies signed with old secrets can still be parsed; new cookies are signed with the new secret.

```tsx
let sessionCookie = createCookie("__session", {
    secrets: [env.NEW_SECRET, env.OLD_SECRET], // New first, old second
});
```

## Session Regeneration

Regenerate the session ID after privilege changes (login, role change) to prevent session fixation attacks.

```tsx
session.regenerateId();       // New ID, keeps data
session.regenerateId(true);   // New ID, deletes old session data
```

## Destroying Sessions

```tsx
session.destroy(); // Clears all data, clears client cookie on next response
```

Used for logout flows. See the remix-auth skill for full authentication patterns.
