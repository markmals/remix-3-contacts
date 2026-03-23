import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

export const QuerySchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

export const FavoriteContactSchema = f.object({
    favorite: f.field(coerce.boolean()),
});

export const UpdateContactSchema = f.object({
    first: f.field(s.defaulted(s.string(), "")),
    last: f.field(s.defaulted(s.string(), "")),
    avatar: f.field(s.defaulted(s.string(), "")),
    bsky: f.field(s.defaulted(s.string(), "")),
    notes: f.field(s.defaulted(s.string(), "")),
});
