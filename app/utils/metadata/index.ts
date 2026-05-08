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
