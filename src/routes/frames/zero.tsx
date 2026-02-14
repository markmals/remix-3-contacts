import type { BuildAction } from "remix/fetch-router";
import { ZeroState } from "~/components/ZeroState.tsx";
import { renderFrame } from "~/lib/responses/render.tsx";
import type { routes } from "~/routes.ts";

export const zero: BuildAction<"ANY", typeof routes.frame.zero> = () => renderFrame(<ZeroState />);
