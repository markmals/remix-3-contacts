import { ConvexClient, ConvexHttpClient } from "convex/browser";

export let convex = {
    http: new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL),
    client: new ConvexClient(import.meta.env.VITE_CONVEX_URL),
};
