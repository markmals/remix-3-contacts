---
name: remix-animations
description: >
  Use when adding animations or transitions to components, including enter/exit
  effects, layout animations for list reordering, spring physics timing,
  shared-layout crossfade, or toggle visibility with animated transitions.
---

# Animations

Use the animation mixins from `remix/component`: `animateEntrance()`, `animateExit()`, and `animateLayout()`. Always provide a stable `key` on elements that should transition.

## Enter Animation

```tsx
import { animateEntrance } from "remix/component";

<div
    mix={[
        animateEntrance({
            opacity: 0,
            transform: "translateY(8px)",
            duration: 180,
            easing: "ease-out",
        }),
    ]}
/>;
```

## Toggle Visibility with Enter + Exit

```tsx
import { animateEntrance, animateExit } from "remix/component";

{isVisible && (
    <div
        key="panel"
        mix={[
            animateEntrance({ opacity: 0, transform: "scale(0.98)", duration: 180 }),
            animateExit({
                opacity: 0,
                transform: "scale(0.98)",
                duration: 120,
                easing: "ease-in",
            }),
        ]}
    />
)}
```

## List Reordering with Layout Animation

```tsx
import { animateLayout, spring } from "remix/component";

{items.map(item => (
    <li key={item.id} mix={[animateLayout({ ...spring({ duration: 500, bounce: 0.2 }) })]}>
        {item.name}
    </li>
))}
```

## Shared-Layout Crossfade

Stack two elements with CSS grid overlap and animate both in and out:

```tsx
<div mix={[css({ display: "grid", "& > *": { gridArea: "1 / 1" } })]}>
    {state ? (
        <div key="a" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
    ) : (
        <div key="b" mix={[animateEntrance({ opacity: 0 }), animateExit({ opacity: 0 })]} />
    )}
</div>
```

## Practical Guidance

- Always `key` conditional or list elements you expect to transition
- Use `animateLayout()` only on the element whose position or size changes
- For spring-style timing, spread `spring()` or `spring("snappy")` into the mixin config
- Default to `...spring()` for duration and easing in most cases -- it produces natural motion
- Keep one clear intent per mixin: entrance starts from an initial style, exit ends at a final style
- See the remix-styling skill for the `css()` mixin used in crossfade examples
