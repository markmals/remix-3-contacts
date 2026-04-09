---
name: remix-auth
description: >-
    Use when implementing authentication, login/logout flows, OAuth or OIDC
    providers, protecting routes with requireAuth, creating session-based or
    bearer token auth schemes, or building credentials login forms with
    progressive enhancement.
---

# Authentication

Depends on sessions being configured first (see remix-sessions skill).

## Auth Middleware Stack

```tsx
import { auth, createSessionAuthScheme, requireAuth } from "remix/auth-middleware";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";

let router = createRouter({
    middleware: [
        session(sessionCookie, sessionStorage),
        formData(),
        auth({
            schemes: [
                createSessionAuthScheme({
                    // Read the auth record from the session
                    read(session) {
                        return session.get("auth") as { userId: string } | null;
                    },
                    // Verify the record is still valid (look up user)
                    verify(value) {
                        return users.getById(value.userId);
                    },
                    // Clean up on invalidation
                    invalidate(session) {
                        session.unset("auth");
                    },
                }),
            ],
        }),
    ],
});
```

## Credentials Login (Email/Password)

```tsx
import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from "remix/auth";

let passwordProvider = createCredentialsAuthProvider({
    parse(context) {
        let formData = context.get(FormData);
        let { email, password } = s.parse(AuthSchema, formData);
        return { email, password };
    },
    async verify({ email, password }) {
        return await users.verifyPassword(email, password);
    },
});

router.map(routes.auth.login.action, {
    async handler(context) {
        let user = await verifyCredentials(passwordProvider, context);

        if (user === null) {
            let session = context.get(Session);
            session.flash("error", "Invalid email or password");
            return redirect(routes.auth.login.href());
        }

        // Rotate session ID (prevents session fixation) and write auth record
        let session = completeAuth(context);
        session.set("auth", { userId: user.id });
        return redirect(routes.dashboard.href());
    },
});
```

## Login Form (Progressive Enhancement)

Works without JavaScript -- standard HTML POST. No `clientEntry` needed for the basic flow.

```tsx
export function LoginForm() {
    return (props: { error?: string }) => (
        <form action={routes.auth.login.action.href()} method={routes.auth.login.action.method}>
            {props.error && <p class="error">{props.error}</p>}
            <label>
                Email
                <input name="email" type="email" required />
            </label>
            <label>
                Password
                <input name="password" type="password" required />
            </label>
            <button type="submit">Log in</button>
        </form>
    );
}
```

## Logout

```tsx
router.map(routes.auth.logout, {
    handler({ get }) {
        let session = get(Session);
        session.unset("auth");
        session.regenerateId(true); // Delete old session data
        return redirect(routes.auth.login.href());
    },
});
```

Logout form -- also a plain `<form method="POST">`, no JavaScript required:

```tsx
<form action={routes.auth.logout.href()} method={routes.auth.logout.method}>
    <button type="submit">Log out</button>
</form>
```

## Protecting Routes

```tsx
import { Auth, requireAuth } from "remix/auth-middleware";
import type { GoodAuth } from "remix/auth-middleware";

router.map(routes.dashboard, {
    middleware: [requireAuth()],
    handler(context) {
        let { identity } = context.get(Auth) as GoodAuth<User>;
        return document(<Dashboard user={identity} />);
    },
});
```

`requireAuth()` returns `401 Unauthorized` by default. Customize with `onFailure`:

```tsx
let requireLogin = requireAuth({
    onFailure(context) {
        let isFrame = context.request.headers.get("x-remix-frame") === "true";
        if (isFrame) {
            return frame(<p>Please log in</p>, { status: 401 });
        }
        return redirect(routes.auth.login.href());
    },
});
```

## External Auth (OAuth/OIDC)

```tsx
import {
    completeAuth,
    createGoogleAuthProvider,
    finishExternalAuth,
    startExternalAuth,
} from "remix/auth";

let googleProvider = createGoogleAuthProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL(routes.auth.google.callback.href(), process.env.APP_ORIGIN),
});

// Start the OAuth redirect
router.map(routes.auth.google.login, {
    handler: context =>
        startExternalAuth(googleProvider, context, {
            returnTo: context.url.searchParams.get("returnTo"),
        }),
});

// Handle the callback
router.map(routes.auth.google.callback, {
    async handler(context) {
        let { result, returnTo } = await finishExternalAuth(googleProvider, context);
        let user = await users.upsertFromGoogle(result.profile);
        let session = completeAuth(context);
        session.set("auth", { userId: user.id });
        return redirect(returnTo ?? routes.dashboard.href());
    },
});
```

**Built-in providers:** Google, Microsoft, Okta, Auth0 (OIDC); GitHub, Facebook, X (OAuth). For custom OIDC providers, use `createOIDCAuthProvider()`.

**External auth flow:**

1. Create the provider once at module scope
2. `startExternalAuth()` from the login route -- redirects to the provider
3. `finishExternalAuth()` from the callback route -- validates the response
4. `completeAuth(context)` to rotate the session ID
5. Write the auth record and redirect

## Multiple Auth Schemes

For APIs that accept both session cookies and bearer tokens. The `auth()` middleware tries each scheme in order.

```tsx
import { createBearerTokenAuthScheme, createSessionAuthScheme } from "remix/auth-middleware";

auth({
    schemes: [
        createSessionAuthScheme({
            /* ... */
        }),
        createBearerTokenAuthScheme({
            async verify(token) {
                return apiKeys.validate(token);
            },
        }),
    ],
});
```
