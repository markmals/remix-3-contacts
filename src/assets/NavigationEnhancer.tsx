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
                    const isFormSubmission = event.formData !== null;

                    if (url.origin !== location.origin) {
                        return;
                    }

                    if (!isFormSubmission && !Matcher.shared.canonical.match(url)) {
                        return;
                    }

                    event.intercept({
                        focusReset: "manual",
                        async precommitHandler() {
                            if (isFormSubmission) {
                                const response = await fetch(url, {
                                    method: "POST",
                                    body: event.formData,
                                    signal: event.signal,
                                });

                                navigation.navigate(response.url);
                                return;
                            }

                            await frames.reload({ for: url }, handle);
                        },
                    });
                },
            });
        }

        return () => null;
    },
);
