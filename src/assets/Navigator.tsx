import { addEventListeners, clientEntry, type Handle } from "remix/component";
import { frames } from "~/frames.ts";
import { NavigationEnhancer } from "~/lib/navigation.ts";
import { routes } from "~/routes.ts";

export const Navigator = clientEntry(
    routes.assets.href({ file: "Navigator", component: "Navigator" }),
    function Navigator(handle: Handle) {
        const enhancer = new NavigationEnhancer();
        enhancer.canIntercept = frames.$.canIntercept;

        addEventListeners(enhancer, handle.signal, {
            navigate(event) {
                const url = event.navigating.to.url;
                event.waitUntil(async () => {
                    await frames.detail.reload(url, handle);
                    await frames.sidebar.reload(url, handle);
                });
            },
        });

        return () => null;
    },
);
