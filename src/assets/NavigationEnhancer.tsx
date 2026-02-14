import { clientEntry, type Handle } from "remix/component";
import { isCanonicalPathname, reloadFrames } from "~/lib/frame-utils.ts";

export const NavigationEnhancer = clientEntry(
    "/assets/NavigationEnhancer.js#NavigationEnhancer",
    function NavigationEnhancer(handle: Handle) {
        if (typeof window !== "undefined") {
            handle.on(navigation, {
                navigate(event) {
                    if (event.hashChange || !event.canIntercept) {
                        return;
                    }

                    const destinationUrl = new URL(event.destination.url);

                    if (destinationUrl.origin !== location.origin) {
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
