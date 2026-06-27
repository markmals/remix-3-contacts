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

export { Head, entriesFromHeadChildren } from "./head.tsx";
export type { HeadProps } from "./head.tsx";

export { collectNormalizedEntriesFromHtml, injectMetadataIntoHtml } from "./ssr.ts";

export {
    renderWithMetadata,
    bufferStream as streamToString,
    createStream as stringToStream,
} from "./stream.ts";

export { MetadataManager, createMetadataManager } from "./manager.ts";

export type { MetadataFrameResponse, MetadataResolveFrame } from "./frames.ts";
export { normalizeFrameHtml, withMetadataFrames } from "./frames.ts";
