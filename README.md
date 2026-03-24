# Remix 3 Contacts Demo

A contacts CRUD app demo, showcasing [Remix 3](https://github.com/remix-run/remix) SSR features. It adapts the [React Router address book tutorial](https://reactrouter.com/tutorials/address-book) to reuse the same patterns in Remix.

## Highlights

- **CRUD server routing** – handlers for listing, creating, updating, and deleting contacts
- [**Frame Navigation primitives**](https://github.com/remix-run/remix/pull/11147) - built-in Remix 3 client-side routing utilizing the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- **RESTful forms** – demonstrates POST/PUT/PATCH/DELETE intercepts
- **URL-driven search** – filters contacts through query parameters

## Tech Stack

- **Framework:** [`remix`](https://npmx.dev/package/remix/v/3.0.0-alpha.3)
- **Toolchain:** [Vite+](https://viteplus.dev)
- **Formatting:** [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) (via `vp fmt`)
- **Linting:** [Oxlint](https://oxc.rs/docs/guide/usage/linter) (via `vp lint`)
- **Type Checking:** [`tsgo`](https://npmx.dev/package/@typescript/native-preview) (via `vp check`)

## Getting Started

```sh
vp install
vp dev          # start the dev server on http://localhost:1612
```

## Production

```sh
vp build        # build to dist/client and dist/ssr
node server.ts  # start production server on http://localhost:1612
vp preview      # or preview the build on http://localhost:4173
```

## Learn More

- [Remix 3 documentation](https://github.com/remix-run/remix/tree/main/packages/component/docs)
- [React Router Tutorial](https://reactrouter.com/tutorials/address-book) (original inspiration)
- [Remix 3: Remixing UI](https://remix.run/blog/remix-jam-2025-recap#remixing-ui)
- [Vite+ documentation](https://github.com/remix-run/remix/tree/main/packages/component/docs)
