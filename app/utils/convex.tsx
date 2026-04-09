import type { FunctionArgs, FunctionReference } from "convex/server";
import type { FormDataObjectSchema } from "remix/data-schema/form-data";

import { ConvexClient, type MutationOptions } from "convex/browser";
import { createMixin, on } from "remix/component";
import * as s from "remix/data-schema";

export let client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

export interface MutateProps<
    Mutation extends FunctionReference<"mutation"> = FunctionReference<"mutation">,
> {
    mutation: Mutation;
    schema: FormDataObjectSchema<FunctionArgs<Mutation>>;
    options?: MutationOptions;
}

let mutateMixin = createMixin<HTMLFormElement, [MutateProps]>(handle => {
    return ({ mutation, schema: Schema, options }) => (
        <handle.element
            mix={on("submit", async event => {
                event.preventDefault();

                let data = new FormData(event.currentTarget, event.submitter);
                let args = s.parse(Schema, data);
                await client.mutation(mutation, args, options);
            })}
        />
    );
});

export function mutate<Mutation extends FunctionReference<"mutation">>(
    props: MutateProps<Mutation>,
) {
    return mutateMixin(props);
}
