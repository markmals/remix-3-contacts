import { TypedEventTarget } from "remix/component";

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
        url: null;
        formData: null;
    };
    Loading: {
        state: "loading";
        url: URL;
        formData: null;
    };
    Submitting: {
        state: "submitting";
        url: URL;
        formData: FormData;
    };
};

type NavigationState = NavigationStates[keyof NavigationStates];

export let isServer = typeof window === "undefined";

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
    to: NavigationState = { state: "idle", url: null, formData: null };
    from: { url: URL | null } = { url: null };

    // No events fire on the server, so skip registering listeners entirely
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
        if (isServer) return;
        super.addEventListener(...args);
    }

    #reset() {
        this.from.url = null;

        this.to.state = "idle";
        this.to.url = null;
        this.to.formData = null;

        this.dispatchEvent(new DestinationChangeEvent(null));
    }

    constructor() {
        super();
        if (isServer) return;

        navigation.addEventListener("navigate", event => {
            this.from.url = new URL(location.href);

            this.to.state = event.formData ? "submitting" : "loading";
            this.to.url = new URL(event.destination.url);
            this.to.formData = event.formData;

            this.dispatchEvent(new DestinationChangeEvent(this.to.url));
        });

        // Clear destination when the navigation is fully finished.
        // The built-in listener uses `handler` (not `precommitHandler`),
        // so the URL commits before frame content loads. Wait for
        // transition.finished to keep the "loading" state visible
        // while frames are still being fetched.
        navigation.addEventListener("currententrychange", () => {
            if (navigation.transition) {
                // Aborted transitions reject with AbortError — a new
                // currententrychange will fire for the replacing navigation.
                navigation.transition.finished.then(
                    () => this.#reset(),
                    () => {},
                );
            } else {
                this.#reset();
            }
        });
    }
}

export let navigating = new Navigating();
