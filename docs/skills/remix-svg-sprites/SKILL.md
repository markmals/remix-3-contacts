---
name: remix-svg-sprites
description: >
  Use when adding icons, creating SVG sprite sheets, building an Icon component,
  referencing symbols with <use href>, or managing SVG assets in the project.
---

# SVG Sprites

Use an SVG sprite sheet -- a single SVG file containing all icons as `<symbol>` elements. Import the sprite URL and reference individual icons by fragment ID.

## Setting Up the Sprite File

`app/icons.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <symbol id="icon-search" viewBox="0 0 24 24">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </symbol>
        <symbol id="icon-plus" viewBox="0 0 24 24">
            <path d="M12 4.5v15m7.5-7.5h-15"
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
        </symbol>
    </defs>
</svg>
```

## Importing the Sprite

```tsx
import iconsHref from "#/icons.svg?url";
```

The `?url` suffix ensures Vite resolves the correct path in both dev and production builds.

## Icon Component Pattern

```tsx
function Icon(props: { name: string; size?: number }) {
    let size = props.size ?? 20;
    return () => (
        <svg aria-hidden="true" width={size} height={size}>
            <use href={`${iconsHref}#icon-${props.name}`} />
        </svg>
    );
}

// Usage:
<Icon name="search" />
<Icon name="plus" size={16} />
<Icon name="trash" size={24} />
```

## Key Rules

- **Import with `?url`** so Vite resolves the correct path in dev and production
- **Reference with `<use href>`** using the sprite URL + `#symbol-id`
- **Use `currentColor`** for `stroke` and `fill` in the sprite so icons inherit color from CSS
- **Use `aria-hidden="true"`** on decorative icons. For meaningful icons, add `aria-label` on the `<svg>` or wrap with visually hidden text
- **Keep all icons in a single sprite file** for a single network request -- the browser caches it across pages

## Adding New Icons

Add a new `<symbol>` element to the sprite file with a unique `id` and `viewBox`. Reference it with the same `Icon` component pattern. No build step or code generation needed.

## Why Sprites Over Inline SVGs

Inline SVGs duplicate markup in every instance and increase HTML payload. A sprite is fetched once, cached, and each `<use>` reference is just a few bytes. This matters in server-rendered apps where minimizing HTML size is important.
