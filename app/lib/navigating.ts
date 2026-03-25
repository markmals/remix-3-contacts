import { addEventListeners, TypedEventTarget } from "remix/component";

declare global {
    interface Navigation extends TypedEventTarget<NavigationEventMap> {}
}

/** Event map for {@link Navigating} */
export interface NavigatingEventMap {
    /** Fired when the pending navigation destination changes or is cleared */
    destinationchange: DestinationChangeEvent;
}

/**
 * Emitted by {@link Navigating} whenever the pending navigation destination changes.
 * `url` is `null` when a navigation completes or is cancelled.
 */
export class DestinationChangeEvent extends Event {
    readonly url: URL | null;

    constructor(url: URL | null) {
        super("destinationchange");
        this.url = url;
    }
}

type NavigationStates = {
    Idle: {
        state: "idle";
        url: undefined;
        formData: undefined;
    };
    Loading: {
        state: "loading";
        url: URL;
        formData: undefined;
    };
    Submitting: {
        state: "submitting";
        url: URL;
        formData: FormData;
    };
};

type NavigationState = NavigationStates[keyof NavigationStates];

export const isServer = typeof window === "undefined";

/**
 * Application-level navigation state tracker.
 *
 * Wraps the Navigation API as a `TypedEventTarget`, collapsing the
 * `navigate` + `currententrychange` pair into a single `destinationchange`
 * event and exposing the current pending destination via `destination`.
 *
 * Safe to instantiate on the server — listeners are only attached client-side.
 */
export class Navigating extends TypedEventTarget<NavigatingEventMap> {
    static #idle: NavigationState = {
        state: "idle",
        url: undefined,
        formData: undefined,
    };

    to: NavigationState;
    from: { url?: URL };

    // No events fire on the server, so skip registering listeners entirely
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
        if (isServer) return;
        super.addEventListener(...args);
    }

    constructor(signal?: AbortSignal) {
        super();

        this.to = structuredClone(Navigating.#idle);
        this.from = { url: undefined };

        if (isServer) return;

        const controller = new AbortController();
        addEventListeners(navigation, controller.signal, {
            navigate: event => {
                this.to = {
                    state: event.formData ? "submitting" : "loading",
                    url: new URL(event.destination.url),
                    formData: event.formData ? event.formData : undefined,
                } as NavigationState;
                this.from = { url: new URL(location.href) };
                this.dispatchEvent(new DestinationChangeEvent(this.to.url!));
            },
            // Clear destination when the navigation is fully finished.
            // The built-in listener uses `handler` (not `precommitHandler`),
            // so the URL commits before frame content loads. Wait for
            // transition.finished to keep the "loading" state visible
            // while frames are still being fetched.
            currententrychange: () => {
                const reset = () => {
                    this.to = structuredClone(Navigating.#idle);
                    this.from = { url: undefined };
                    this.dispatchEvent(new DestinationChangeEvent(null));
                };

                if (navigation.transition) {
                    navigation.transition.finished.then(reset);
                } else {
                    reset();
                }
            },
        });

        signal?.addEventListener("abort", controller.abort, { once: true });
    }
}

export const navigating = new Navigating();
