export type {
    MetadataElementType,
    MetadataEntry,
    MetadataLifecycle,
    MetadataManagerOptions,
    MetadataPrimitive,
    MetadataProps,
    NormalizedMetadataEntry,
} from "./types.ts";

export {
    deriveEntryKey,
    getEntryLifecycle,
    getPrecedence,
    isResourceHint,
    isSupportedEntry,
    normalizeEntry,
} from "./rules.ts";

export {
    collectPrecedenceOrder,
    dedupeEntries,
    renderHeadEntriesToHtml,
    renderHeadEntryToHtml,
} from "./html.ts";

export type { MetadataTransportPayload } from "./transport.ts";
export {
    createTransportHtml,
    extractTransportTemplates,
    parseTransportTemplate,
    stripTransportTemplates,
} from "./transport.ts";
