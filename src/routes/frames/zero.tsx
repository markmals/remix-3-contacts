import type { BuildAction } from "remix/fetch-router";
import { ZeroState } from "~/components/ZeroState.tsx";
import { html } from "~/lib/responses/html.tsx";
import type { routes } from "~/routes.ts";

export const zero: BuildAction<"ANY", typeof routes.frame.zero> = () => html(<ZeroState />);
