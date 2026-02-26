import { clientEntry, type Handle } from "remix/component";
import { frames } from "~/frames.ts";
import { routes } from "~/routes.ts";

export const NavigationEnhancer = clientEntry(
    routes.assets.href({ file: "NavigationEnhancer", component: "NavigationEnhancer" }),
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

                    if (!isFormSubmission && !frames.canIntercept(url)) {
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

                            // Reload all frames with new URL
                            await frames.reload.detail(url, handle);
                            await frames.reload.sidebar(url, handle);
                        },
                    });
                },
            });
        }

        return () => null;
    },
);
