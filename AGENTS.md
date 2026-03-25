# Contributor Guidelines

## Remix Documentation

This repository contains a comprehensive overview of the Remix Component API, its runtime behavior, and practical use cases for building interactive UIs, as well as documentation on various other sub-packages included within the `remix` package. We are using a nightly of the `remix` package which has newly-added support for server-side rendering components, hydrating components, and the Remix `<Frame>` primitive.

> Take a look at the files in `./docs/*.md` for detailed documentation on the many functions of the `remix` component API.

## Debugging Approach

- Use `console.log` with clear prefixes during development
- **NEVER** attempt to run the dev server yourself
- If you need to do some debugging, add some `console.log` statements, tell me where I need to look for the `console.log` statements when I run the project myself (client, server, both, somewhere else, etc.), and then I will come back and paste the results of the `console.log` statements for you

## Toolchain

This project uses **Vite+** (Vite 8 + Rolldown) as its unified toolchain. All commands go through `vp`:

- `vp dev` — start the dev server
- `vp build` — production build to `dist/client` and `dist/ssr`
- `vp preview` — preview the production build
- `vp fmt` — format code with Oxfmt
- `vp lint` — lint code with Oxlint
- `vp check` — run format, lint, and typecheck together
- `vp install` / `vp add` / `vp remove` — package management (delegates to pnpm)

Configuration for formatting, linting, and build lives in `vite.config.ts`. There is no separate linter or formatter config file.

## Node.js

- Always use the `node:` prefix for Node built-in module imports
- Format and lint code with `vp fmt` and `vp lint` before committing
- Run `vp check` and fix all info, warnings, and errors
- Prefer `unknown` over `any` unless absolutely necessary
- Use JSDoc/TSDoc comments for public APIs
- Document important lines of code with a single line comment
- Prefer `jsr:@std/*` for standard library
    - JSR packages can be installed using `vp add jsr:package-name`
- Use relative imports for local modules
- Prefer import aliases over relative imports for local modules
- Validate environment variables at startup using `jsr:@std/assert`

## General Rules

### Correctness

- **Remove anything that isn't used** – delete unused imports, function parameters, and private class members.
- **Use only real selectors** – in CSS, reference valid pseudo-classes, pseudo-elements, and type selectors only.

### Suspicious Code

- **Skip the "any" shortcut** – prefer precise TypeScript types.
- **Hands off `document.cookie`** – manipulating cookies directly is forbidden. Use Remix's cookie utilities instead.

### Performance

- **Compile regexes once** – declare regular expressions at module scope, not inside hot functions.

### Style & Consistency

- **Stick to ES modules** – no `require` or other CommonJS patterns.
- **Prefer `import type`** – separate type-only imports.
- **Use the `node:` protocol** – write `import fs from 'node:fs'` rather than bare `'fs'`.
- **Arrays = `T[]`** – use shorthand array syntax consistently.
- **Don't reassign parameters** – treat function arguments as read-only.
- **Favor `let`** – use `let` over `const` for bindings, unless declaring a truly top-level constant. Then declare it with an all caps binding as a `const`.
- **One `let` per line** – declare variables individually.
- **Skip non-null assertions** – rewrite code so `!` isn't necessary.
- **Avoid `enum`** – choose unions, objects, or literal types instead.
- **Stick with `trimStart/End`** – don't use `trimLeft/Right`.
- **Default parameters go last** – never precede required params with optional ones.
- **Self-close when empty** – use `<Component />` instead of `<Component></Component>` when there are no children.
- **No unused template literals** – convert to quotes if you're not interpolating.
- **Don't write `substr`** – use `slice` instead.
- **Flatten simple `if` chains** – collapse `else { if … }` when feasible.
- **Keep member access simple** – omit `public`, `private`, or `protected`. Use native JavaScript private properties (e.g. `#property`) when you need to make a property private.
- **Leverage `as const`** – assert immutability where appropriate.
- **Kill useless `else` blocks** – when the `if` branch returns or throws, omit the `else`.
