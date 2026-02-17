import { clientEntry, type Handle } from "remix/component";
import { frames } from "~/lib/frame-utils.ts";
import { Matcher } from "~/lib/matcher.ts";

export const NavigationEnhancer = clientEntry(
    "/assets/NavigationEnhancer.js#NavigationEnhancer",
    function NavigationEnhancer(handle: Handle) {
        if (typeof window !== "undefined") {
            handle.on(navigation, {
                navigate(event) {
                    if (event.hashChange || !event.canIntercept) {
                        return;
                    }

                    const url = new URL(event.destination.url);

                    if (url.origin !== location.origin) {
                        return;
                    }

                    if (!Matcher.shared.canonical.match(url)) {
                        return;
                    }

                    event.intercept({
                        focusReset: "manual",
                        async precommitHandler() {
                            await frames.reload({ for: url }, handle);
                        },
                    });
                },
            });
        }

        return () => null;
    },
);
