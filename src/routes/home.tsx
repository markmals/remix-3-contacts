import type { BuildAction } from "remix/fetch-router";
import { Document } from "~/components/Document.tsx";
import { render } from "~/lib/render.tsx";
import type { routes } from "~/routes.ts";

export const home: BuildAction<"ANY", typeof routes.home> = () => render.document(<Document />);
