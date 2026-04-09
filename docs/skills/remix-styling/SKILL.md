---
name: remix-styling
description: >
    Use when styling components, choosing between CSS files and the css() mixin,
    applying inline styles, using CSS custom properties for dynamic values, or
    adding component-scoped CSS with nested selectors, media queries, or
    pseudo-elements.
---

# Styling Components

## Decision Framework

| Approach                       | Use for                                        | Example                                         |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `.css` files                   | App-wide layout, typography, resets            | Global stylesheet                               |
| `css()` mixin                  | Component-scoped static rules with selectors   | Hover states, media queries, pseudo-elements    |
| `style` with custom properties | Dynamic values that change with state          | Active/inactive colors, computed positions      |
| Direct `style`                 | Rare -- only for truly one-off computed values | `style={{ transform: \`translateX(${x}px)\` }}` |

## External CSS (Default Choice)

```tsx
import styles from "#/index.css?url";

// In your document shell:
<link href={styles} rel="stylesheet" />;
```

## `css()` Mixin -- Component-Scoped Rules

Supports nested selectors (`&:hover`, `&::before`), media queries, and pseudo-elements. Generates real stylesheet rules (more performant than inline styles for static values).

```tsx
import { css } from "remix/component";

<button
    mix={[
        css({
            color: "white",
            backgroundColor: "var(--color-primary)",
            "&:hover": { backgroundColor: "var(--color-primary-dark)" },
            "&:focus-visible": { outline: "2px solid var(--color-focus)" },
            "@media (max-width: 768px)": { width: "100%" },
        }),
    ]}
>
    Submit
</button>;
```

## Dynamic Values with CSS Custom Properties

Set a CSS custom property via `style` and reference it from `css()` or your stylesheet:

```tsx
<div
    mix={[
        css({
            backgroundColor: "var(--bg)",
            transition: "background-color 200ms ease",
        }),
    ]}
    style={{ "--bg": isActive ? "var(--color-active)" : "var(--color-muted)" }}
>
    {children}
</div>
```

**Why custom properties over direct inline styles:** CSS custom properties keep styling in one system. Stylesheets and `css()` rules can reference the same property, transitions work naturally, and you avoid specificity fights between inline styles and CSS rules.
