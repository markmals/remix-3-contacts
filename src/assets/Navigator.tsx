import { addEventListeners, clientEntry, type Handle } from "remix/component";
import { frames } from "~/frames.ts";
import { NavigationEnhancer } from "~/lib/navigation.ts";
import { routes } from "~/routes.ts";

export const Navigator = clientEntry(
    routes.assets.href({ file: "Navigator", component: "Navigator" }),
    function Navigator(handle: Handle) {
        const enhancer = new NavigationEnhancer();
        enhancer.canIntercept = url => frames.canIntercept(url);

        addEventListeners(enhancer, handle.signal, {
            navigate(event) {
                const url = event.navigating.to.url;
                event.waitUntil(async () => {
                    await frames.reload.detail(url, handle);
                    await frames.reload.sidebar(url, handle);
                });
            },
        });

        return () => null;
    },
);
