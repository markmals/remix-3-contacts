import type { BuildAction } from "remix/fetch-router";
import { createRedirectResponse as redirect } from "remix/response/redirect";
import { routes } from "~/routes.ts";

export const newContact: BuildAction<"GET", typeof routes.contacts.new> = () =>
    redirect(routes.home.href());
