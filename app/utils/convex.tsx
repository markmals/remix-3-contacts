import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { createMixin, on, TypedEventTarget } from "remix/component";

import { IS_SERVER } from "./server.ts";

export let convex = {
    http: new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL),
    client: new ConvexClient(import.meta.env.VITE_CONVEX_URL),
};

// ---------------------------------------------------------------------------
// ConvexQuery — TypedEventTarget wrapper around convex.client.onUpdate()
// ---------------------------------------------------------------------------

/** Fired when a subscription delivers a new result. */
export class ConvexQueryUpdateEvent<T> extends Event {
    readonly data: T;

    constructor(data: T) {
        super("update");
        this.data = data;
    }
}

export interface ConvexQueryEventMap<T> {
    update: ConvexQueryUpdateEvent<T>;
}

export interface ConvexQueryOptions {
    signal?: AbortSignal;
}

/**
 * Reactive wrapper around `convex.client.onUpdate()`.
 *
 * Subscribes to a Convex query and emits typed `update` events when new
 * results arrive. Handles resubscription when args change via `.update()`.
 * Server-safe — all operations are no-ops when running outside the browser.
 */
export class ConvexQuery<Query extends FunctionReference<"query">> extends TypedEventTarget<
    ConvexQueryEventMap<FunctionReturnType<Query>>
> {
    data: FunctionReturnType<Query> | undefined = undefined;
    #query: Query;
    #args: FunctionArgs<Query>;
    #unsubscribe: (() => void) | undefined;
    #disposed = false;

    constructor(query: Query, args: FunctionArgs<Query>, options?: ConvexQueryOptions) {
        super();
        this.#query = query;
        this.#args = args;

        if (IS_SERVER) return;

        this.#subscribe();

        if (options?.signal) {
            options.signal.addEventListener("abort", () => this.#dispose(), { once: true });
        }
    }

    /** No-ops on the server. Skips addEventListener entirely. */
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
        if (IS_SERVER) return;
        super.addEventListener(...args);
    }

    /** Update subscription args. Resubscribes only if args actually changed. */
    update(args: FunctionArgs<Query>) {
        if (IS_SERVER) return;
        if (JSON.stringify(args) === JSON.stringify(this.#args)) return;
        this.#args = args;
        this.#unsubscribe?.();
        this.#subscribe();
    }

    #subscribe() {
        if (this.#disposed) return;

        this.#unsubscribe = convex.client.onUpdate(this.#query, this.#args, result => {
            this.data = result;
            this.dispatchEvent(new ConvexQueryUpdateEvent(result));
        });
    }

    #dispose() {
        this.#disposed = true;
        this.#unsubscribe?.();
        this.#unsubscribe = undefined;
    }
}

// ---------------------------------------------------------------------------
// mutate() — createMixin-based form mutation helper
// ---------------------------------------------------------------------------

declare global {
    interface HTMLElementEventMap {
        [mutate.submit]: MutateSubmitEvent<unknown>;
        [mutate.success]: MutateSuccessEvent<unknown>;
        [mutate.error]: MutateErrorEvent;
    }
}

/** Fired before the mutation runs. Call `preventDefault()` to cancel. */
export class MutateSubmitEvent<Args> extends Event {
    readonly args: Args;

    constructor(args: Args) {
        super(mutate.submit, { bubbles: true, cancelable: true });
        this.args = args;
    }
}

/** Fired after the mutation resolves successfully. */
export class MutateSuccessEvent<T> extends Event {
    readonly result: T;

    constructor(result: T) {
        super(mutate.success, { bubbles: true });
        this.result = result;
    }
}

/** Fired if the mutation rejects. */
export class MutateErrorEvent extends Event {
    readonly error: Error;

    constructor(error: Error) {
        super(mutate.error, { bubbles: true });
        this.error = error;
    }
}

type AnyMutation = FunctionReference<"mutation">;
type ArgsOrMapper<M extends AnyMutation> =
    | FunctionArgs<M>
    | ((formData: FormData) => FunctionArgs<M>);

// Hoisted mixin — stable type identity across renders.
// The runner receives the latest mutation + argsOrMapper each render.
let mutateMixin = createMixin<
    HTMLFormElement,
    [mutation: AnyMutation, argsOrMapper: ArgsOrMapper<AnyMutation>]
>(handle => {
    return (mutation, argsOrMapper) => {
        return (
            <handle.element
                mix={on("submit", async event => {
                    event.preventDefault();

                    let form = event.currentTarget;
                    let args =
                        typeof argsOrMapper === "function"
                            ? argsOrMapper(new FormData(form))
                            : argsOrMapper;

                    let submitEvent = new MutateSubmitEvent(args);
                    form.dispatchEvent(submitEvent);
                    if (submitEvent.defaultPrevented) return;

                    try {
                        let result = await convex.client.mutation(mutation, args);
                        form.dispatchEvent(new MutateSuccessEvent(result));
                    } catch (err) {
                        form.dispatchEvent(
                            new MutateErrorEvent(
                                err instanceof Error ? err : new Error(String(err)),
                            ),
                        );
                    }
                })}
            />
        );
    };
});

/**
 * Form mixin that runs a Convex mutation on submit.
 *
 * Dispatches `mutate:submit` (cancelable), `mutate:success`, and `mutate:error`
 * events on the form element at each stage of the mutation lifecycle.
 *
 * @param mutation - A Convex mutation FunctionReference.
 * @param argsOrMapper - Either static args or a `(formData) => args` function.
 */
export function mutate<Mutation extends AnyMutation>(
    mutation: Mutation,
    argsOrMapper: ArgsOrMapper<Mutation>,
) {
    return mutateMixin(mutation, argsOrMapper as ArgsOrMapper<AnyMutation>);
}

mutate.submit = "mutate:submit" as const;
mutate.success = "mutate:success" as const;
mutate.error = "mutate:error" as const;
