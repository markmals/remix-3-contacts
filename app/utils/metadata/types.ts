export type MetadataElementType = "title" | "meta" | "link" | "style" | "script";

export type MetadataLifecycle = "replaceable" | "sticky";

export type MetadataPrimitive = string | boolean | number | null | undefined;

export type MetadataProps = Record<string, MetadataPrimitive>;

export interface MetadataEntry {
    type: MetadataElementType;
    key?: string;
    props: MetadataProps;
    children?: string;
    order?: number;
    owner?: string;
    lifecycle?: MetadataLifecycle;
}

export interface NormalizedMetadataEntry extends MetadataEntry {
    key: string;
    lifecycle: MetadataLifecycle;
}

export interface MetadataManagerOptions {
    precedence?: string[];
    titleTemplate?: (title: string | null) => string;
}
