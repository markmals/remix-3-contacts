import type { Router } from "remix/fetch-router";

import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";

let storage = new AsyncLocalStorage<Env>();

export function getEnv() {
    let env = storage.getStore();
    assert(env, "Did not provide Cloudflre Worker env for D1 binding");
    return env;
}

export function provideEnv(request: Request, env: Env, router: Router) {
    return storage.run(env, () => router.fetch(request));
}
