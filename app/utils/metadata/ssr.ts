import { renderHeadEntriesToHtml } from "./html.ts";
import { normalizeEntry } from "./rules.ts";
import { extractTransportTemplates } from "./transport.ts";
import type { MetadataManagerOptions, NormalizedMetadataEntry } from "./types.ts";

export function collectNormalizedEntriesFromHtml(html: string): NormalizedMetadataEntry[] {
    let entries: NormalizedMetadataEntry[] = [];

    for (let payload of extractTransportTemplates(html)) {
        for (let entry of payload.entries) {
            let normalized = normalizeEntry({
                ...entry,
                owner: payload.owner,
            });

            if (normalized) entries.push(normalized);
        }
    }

    return entries;
}

export function injectMetadataIntoHtml(html: string, options: MetadataManagerOptions = {}): string {
    let closingHeadIndex = html.search(/<\/head\s*>/i);
    if (closingHeadIndex === -1) {
        throw new Error("Cannot inject metadata: missing closing </head> tag");
    }

    let entries = collectNormalizedEntriesFromHtml(html);
    if (entries.length === 0) return html;

    let headHtml = renderHeadEntriesToHtml(entries, {
        precedence: options.precedence,
    });

    return `${html.slice(0, closingHeadIndex)}${headHtml}${html.slice(closingHeadIndex)}`;
}
