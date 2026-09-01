import { createMixin } from "remix/ui";

export type LinkProps = { target?: string; src?: URL; resetScroll?: boolean };

// Only created instead of `remix/ui.link()` to support button elements
// for our custom form submission handling as well as anchor elements
export let link = createMixin<HTMLAnchorElement | HTMLButtonElement, [LinkProps]>(handle => {
    return props => (
        <handle.element
            data-rmx-reset-scroll={props.resetScroll != null ? `${props.resetScroll}` : undefined}
            data-rmx-src={props.src?.toString()}
            data-rmx-target={props.target}
        />
    );
});
