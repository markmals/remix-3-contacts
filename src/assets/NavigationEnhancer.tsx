import { clientEntry, type Handle } from "remix/component";
import { isCanonicalPathname, reloadFrames } from "~/lib/frame-utils.ts";

declare global {
    interface Navigation {
        __eventMap?: NavigationEventMap;
    }
}

export const NavigationEnhancer = clientEntry(
    "/assets/NavigationEnhancer.js#NavigationEnhancer",
    function NavigationEnhancer(handle: Handle) {
        if (typeof window !== "undefined") {
            handle.on(window.navigation, {
                navigate(event) {
                    if (event.hashChange || !event.canIntercept) {
                        return;
                    }

                    const destinationUrl = new URL(event.destination.url);

                    if (destinationUrl.origin !== window.location.origin) {
                        return;
                    }

                    if (!isCanonicalPathname(destinationUrl.pathname)) {
                        return;
                    }

                    event.intercept({
                        async handler() {
                            await reloadFrames(handle, destinationUrl);
                        },
                    });
                },
            });
        }

        return () => null;
    },
);
