import { createMixin } from "remix/component";

export type LinkProps = { target?: string; src?: URL; resetScroll?: boolean };

// Only created instead of `remix/component.link()` to support button elements
// for our custom form submission handling as well as anchor elements
export let link = createMixin<HTMLAnchorElement | HTMLButtonElement, [LinkProps]>(handle => {
    return props => (
        <handle.element
            rmx-reset-scroll={props.resetScroll != null ? `${props.resetScroll}` : undefined}
            rmx-src={props.src?.toString()}
            rmx-target={props.target}
        />
    );
});
