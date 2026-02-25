import type { TypedEventTarget } from "remix/interaction";

declare global {
    interface Navigation extends TypedEventTarget<NavigationEventMap> {}
}
