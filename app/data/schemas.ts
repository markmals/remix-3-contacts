import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

export let QuerySchema = f.object({
    q: f.field(s.union([s.string(), s.undefined_()])),
});

export let IdSchema = s.object({ id: s.string() });
