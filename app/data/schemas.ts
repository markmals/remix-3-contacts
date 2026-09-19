import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

export let QuerySchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

export let FavoriteSchema = f.object({
    favorite: f.field(coerce.boolean()),
});

export let UpdateSchema = f.object({
    first: f.field(s.defaulted(s.string(), "")),
    last: f.field(s.defaulted(s.string(), "")),
    avatar: f.field(s.union([s.string(), s.undefined_()])),
    bsky: f.field(s.defaulted(s.string(), "")),
    notes: f.field(s.defaulted(s.string(), "")),
});

export let IdSchema = s.object({ id: coerce.number() });

/**
 * The `q` search filter from a URL.
 *
 * A filter that doesn't parse is treated as no filter rather than a client
 * error: narrowing a list is not an identifier or a mutation payload, so the
 * useful answer is the unfiltered list, not a 400.
 */
export function searchQuery(url: URL): string | undefined {
    let result = s.parseSafe(QuerySchema, url.searchParams);
    return result.success ? result.value.q : undefined;
}
