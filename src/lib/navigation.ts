import { on, TypedEventTarget } from "remix/interaction";

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

    constructor(signal?: AbortSignal) {
        super();

        this.to = structuredClone(Navigating.#idle);
        this.from = { url: undefined };

        if (isServer) return;

        const dispose = on(navigation, {
            navigate: event => {
                this.to = {
                    state: event.formData ? "submitting" : "loading",
                    url: new URL(event.destination.url),
                    formData: event.formData ? event.formData : undefined,
                } as NavigationState;
                this.from = { url: new URL(window.location.href) };
                this.dispatchEvent(new DestinationChangeEvent(this.to.url!));
            },
            // Clear destination when the current entry is committed
            currententrychange: () => {
                this.to = structuredClone(Navigating.#idle);
                this.from = { url: undefined };
                this.dispatchEvent(new DestinationChangeEvent(null));
            },
        });

        if (signal) {
            on(signal, {
                abort: {
                    once: true,
                    listener: dispose,
                },
            });
        }
    }
}

export const navigating = new Navigating();

/** Event map for {@link Navigating} */
export interface RouterEventMap {
    /** Fired when the pending navigation destination changes or is cleared */
    navigate: NavigateEvent;
}

// to: NavigationState;
// from: { url?: URL };

export namespace NavigateEvent {
    export type NonIdleNavigation = NavigationStates["Loading"] | NavigationStates["Submitting"];

    export interface Navigating {
        to: NonIdleNavigation;
        from: { url: URL };
    }
}

/**
 * Emitted by {@link Navigating} whenever the pending navigation destination changes.
 * `url` is `null` when a navigation completes or is cancelled.
 */
export class NavigateEvent extends Event {
    #promises: Promise<void>[] = [];
    navigating: NavigateEvent.Navigating;

    constructor(navigating: NavigateEvent.Navigating) {
        super("navigate");
        this.navigating = navigating;
    }

    waitUntil(promiseOrFn: Promise<void> | (() => Promise<void>)): void {
        this.#promises.push(typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn);
    }

    /** Resolves once all promises registered via {@link waitUntil} have settled. */
    settled(): Promise<void> {
        return Promise.all(this.#promises).then(() => {});
    }
}

export class NavigationEnhancer extends TypedEventTarget<RouterEventMap> {
    canIntercept?: (url: URL) => boolean;

    constructor(signal?: AbortSignal) {
        super();

        if (isServer) return;

        const dispose = on(navigation, {
            navigate: event => {
                if (event.hashChange || !event.canIntercept) {
                    return;
                }

                const url = new URL(event.destination.url);
                const isFormSubmission = event.formData !== null;

                if (url.origin !== location.origin) {
                    return;
                }

                const canIntercept = this.canIntercept ? this.canIntercept(url) : true;

                if (!isFormSubmission && !canIntercept) {
                    return;
                }

                event.intercept({
                    focusReset: "manual",
                    precommitHandler: async () => {
                        if (isFormSubmission) {
                            const response = await fetch(url, {
                                method: "POST",
                                body: event.formData,
                                signal: event.signal,
                            });

                            navigation.navigate(response.url);
                            return;
                        }

                        const navigateEvent = new NavigateEvent(
                            navigating as NavigateEvent.Navigating,
                        );
                        this.dispatchEvent(navigateEvent);
                        await navigateEvent.settled();
                    },
                });
            },
        });

        if (signal) {
            on(signal, {
                abort: {
                    once: true,
                    listener: dispose,
                },
            });
        }
    }
}
