import * as s from "remix/data-schema";
import { maxLength } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const MAX_NAME = 100;
const MAX_HANDLE = 253;
const MAX_NOTES = 10_000;

/**
 * A Bluesky handle is a DNS name: dot-separated labels of letters, digits and
 * hyphens. A leading `@` is accepted because people paste it that way;
 * `updateContact()` strips it before the write.
 */
const BSKY_HANDLE = /^@?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * An avatar is only ever the path `uploadHandler` returned for a file this app
 * stored. Constraining it keeps a hand-crafted submission from pointing the
 * `<img>` at somebody else's server.
 */
const UPLOAD_PATH = /^\/uploads\/[\w.-]+\/[\w.-]+$/;

export let QuerySchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

export let FavoriteSchema = f.object({
    favorite: f.field(coerce.boolean()),
});

export let UpdateSchema = f.object({
    first: f.field(s.defaulted(s.string().pipe(maxLength(MAX_NAME)), "")),
    last: f.field(s.defaulted(s.string().pipe(maxLength(MAX_NAME)), "")),
    avatar: f.field(
        s
            .union([s.string(), s.undefined_()])
            .refine(value => !value || UPLOAD_PATH.test(value), "Expected an uploaded image path"),
    ),
    bsky: f.field(
        s.defaulted(
            s
                .string()
                .pipe(maxLength(MAX_HANDLE))
                .refine(
                    value => value === "" || BSKY_HANDLE.test(value),
                    "Expected a Bluesky handle like jay.bsky.team",
                ),
            "",
        ),
    ),
    notes: f.field(s.defaulted(s.string().pipe(maxLength(MAX_NOTES)), "")),
});

export let IdSchema = s.object({
    id: coerce
        .number()
        .refine(
            value => Number.isFinite(value) && Number.isInteger(value) && value >= 0,
            "Id must be a finite positive integer",
        ),
});

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
