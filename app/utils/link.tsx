import { createMixin } from "remix/ui";

/**
 * Frame-targeting attributes for a form's submit button.
 *
 * Anchors and forms take `data-rmx-target`/`data-rmx-src` as plain typed props,
 * so they need no mixin. A submit *button* does need one, for two reasons:
 *
 * - `remix/ui`'s own `link()` gives non-anchor hosts link semantics — it forces
 *   `type="button"` and calls `navigate()` from a `preventDefault`ed click,
 *   which would stop the enclosing form from submitting at all.
 * - `ButtonHTMLProps` doesn't declare the `data-rmx-*` attributes even though
 *   the runtime reads them off a submitter, so they can't be passed directly.
 *
 * The runtime prefers the submitter's attributes over the form's, making this
 * the frame-targeting equivalent of `formaction`.
 */
export let link = createMixin<HTMLButtonElement, [{ target?: string; src?: URL }]>(handle => {
    return props => (
        <handle.element data-rmx-src={props.src?.toString()} data-rmx-target={props.target} />
    );
});
