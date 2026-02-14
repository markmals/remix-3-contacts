# Remix 3 Contacts Demo

A contacts CRUD app demo, showcasing [Remix 3](https://github.com/remix-run/remix) SSR features. It adapts the [React Router address book tutorial](https://reactrouter.com/tutorials/address-book) to reuse the same patterns in Remix.

## Highlights

- **CRUD routing** – handlers for listing, creating, updating, and deleting contacts
- **Enhanced forms** – demonstrates POST/PUT/DELETE intercepts with optimistic navigation state
- **URL-driven search** – filters contacts through query parameters
- **Config-driven routing** – handlers in `src/routes/*.ts(x)`

## Tech Stack

- **Framework:** [`remix`](https://npmx.dev/package/remix/v/3.0.0-alpha.2)
- **Server:** [`tsx`](https://npmx.dev/package/tsx)
- **Build:** [`esbuild`](https://npmx.dev/package/esbuild)
- **Language:** TypeScript/TSX

## Getting Started

Run these commands:

```sh
pnpm install
pnpm run dev     # start the server on http://localhost:1612
```

## Learn More

- [Remix 3 documentation](https://github.com/remix-run/remix/tree/main/packages/component/docs)
- [React Router Tutorial](https://reactrouter.com/tutorials/address-book) (original inspiration)
- [Remix 3: Remixing UI](https://remix.run/blog/remix-jam-2025-recap#remixing-ui)
