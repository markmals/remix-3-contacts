import type { MetadataEntry, MetadataLifecycle, NormalizedMetadataEntry } from "./types.ts";

const RESOURCE_HINT_RELS = new Set(["dns-prefetch", "preconnect", "preload", "modulepreload"]);

function propString(entry: MetadataEntry, name: string): string | undefined {
    let value = entry.props[name];
    if (value === null || value === undefined || typeof value === "boolean") return undefined;
    return String(value);
}

function lowerProp(entry: MetadataEntry, name: string): string | undefined {
    return propString(entry, name)?.toLowerCase();
}

function hasProp(entry: MetadataEntry, name: string): boolean {
    return entry.props[name] !== null && entry.props[name] !== undefined;
}

export function deriveEntryKey(entry: MetadataEntry): string {
    if (entry.key) return entry.key;

    switch (entry.type) {
        case "title":
            return "title";

        case "meta": {
            if (hasProp(entry, "charset")) return "meta:charset";

            let name = lowerProp(entry, "name");
            if (name) return `meta:name:${name}`;

            let property = lowerProp(entry, "property");
            if (property) return `meta:property:${property}`;

            let httpEquiv = lowerProp(entry, "httpEquiv") ?? lowerProp(entry, "http-equiv");
            if (httpEquiv) return `meta:http-equiv:${httpEquiv}`;

            return "meta:unknown";
        }

        case "link": {
            let rel = lowerProp(entry, "rel");
            let href = propString(entry, "href");

            if (rel === "canonical") return "link:canonical";
            if (rel && href) return `link:${rel}:${href}`;

            return "link:unknown";
        }

        case "style": {
            let href = propString(entry, "href");
            return href ? `style:${href}` : "style:unknown";
        }

        case "script": {
            let src = propString(entry, "src");
            return src ? `script:${src}` : "script:unknown";
        }
    }
}

export function isSupportedEntry(entry: MetadataEntry): boolean {
    if (hasProp(entry, "itemProp")) return false;

    switch (entry.type) {
        case "title":
            return true;

        case "meta":
            return (
                hasProp(entry, "charset") ||
                hasProp(entry, "name") ||
                hasProp(entry, "property") ||
                hasProp(entry, "httpEquiv") ||
                hasProp(entry, "http-equiv")
            );

        case "link": {
            let rel = lowerProp(entry, "rel");
            let href = propString(entry, "href");
            if (!rel || !href) return false;
            if (rel === "stylesheet") return hasProp(entry, "precedence");
            return true;
        }

        case "style":
            return hasProp(entry, "href") && hasProp(entry, "precedence");

        case "script":
            return typeof entry.props.src === "string" && entry.props.async === true;
    }
}

export function getEntryLifecycle(entry: MetadataEntry): MetadataLifecycle {
    if (entry.lifecycle) return entry.lifecycle;

    if (entry.type === "script" || entry.type === "style") return "sticky";

    if (entry.type === "link") {
        let rel = lowerProp(entry, "rel");
        if (rel === "stylesheet" || (rel && RESOURCE_HINT_RELS.has(rel))) {
            return "sticky";
        }
    }

    return "replaceable";
}

export function normalizeEntry(entry: MetadataEntry): NormalizedMetadataEntry | null {
    if (!isSupportedEntry(entry)) return null;

    return {
        ...entry,
        key: deriveEntryKey(entry),
        lifecycle: getEntryLifecycle(entry),
    };
}

export function isResourceHint(entry: NormalizedMetadataEntry): boolean {
    return entry.type === "link" && RESOURCE_HINT_RELS.has(lowerProp(entry, "rel") ?? "");
}

export function getPrecedence(entry: NormalizedMetadataEntry): string | undefined {
    return propString(entry, "precedence");
}
