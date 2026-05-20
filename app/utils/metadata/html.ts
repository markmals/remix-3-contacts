import type { NormalizedMetadataEntry } from "./types.ts";

import { getPrecedence, isResourceHint } from "./rules.ts";

const VOID_ELEMENTS = new Set(["meta", "link"]);

function escapeText(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/g, "&quot;");
}

function renderAttributes(entry: NormalizedMetadataEntry): string {
    let attrs: string[] = [
        'data-pitlane-metadata-managed="true"',
        `data-pitlane-metadata-owner="${escapeAttribute(entry.owner ?? "document")}"`,
        `data-pitlane-metadata-key="${escapeAttribute(entry.key)}"`,
    ];

    if (entry.lifecycle === "sticky") {
        attrs.push('data-pitlane-metadata-lifecycle="sticky"');
    }

    for (let [name, value] of Object.entries(entry.props)) {
        if (name === "children" || name === "key") continue;
        if (value === null || value === undefined || value === false) continue;

        let htmlName = name === "httpEquiv" ? "http-equiv" : name;

        if (value === true) {
            attrs.push(htmlName);
            continue;
        }

        attrs.push(`${htmlName}="${escapeAttribute(String(value))}"`);
    }

    return attrs.join(" ");
}

export function renderHeadEntryToHtml(entry: NormalizedMetadataEntry): string {
    let attrs = renderAttributes(entry);

    if (VOID_ELEMENTS.has(entry.type)) {
        return `<${entry.type} ${attrs}>`;
    }

    return `<${entry.type} ${attrs}>${escapeText(entry.children ?? "")}</${entry.type}>`;
}

function getEntryBucket(entry: NormalizedMetadataEntry): number {
    if (entry.type === "meta" && entry.props.charset) return 0;
    if (isResourceHint(entry)) return 1;
    if (entry.type === "link" && String(entry.props.rel).toLowerCase() === "stylesheet") return 2;
    if (entry.type === "style") return 2;
    if (entry.type === "meta") return 3;
    if (entry.type === "title") return 4;
    if (entry.type === "link" && String(entry.props.rel).toLowerCase() === "canonical") return 4;
    if (entry.type === "script") return 5;
    return 3;
}

export function collectPrecedenceOrder(
    entries: NormalizedMetadataEntry[],
    initialOrder: string[] = [],
): string[] {
    let order = [...initialOrder];

    for (let entry of entries) {
        let precedence = getPrecedence(entry);
        if (precedence && !order.includes(precedence)) {
            order.push(precedence);
        }
    }

    return order;
}

function compareEntries(
    left: NormalizedMetadataEntry,
    right: NormalizedMetadataEntry,
    precedenceOrder: string[],
): number {
    let bucketDiff = getEntryBucket(left) - getEntryBucket(right);
    if (bucketDiff !== 0) return bucketDiff;

    let leftPrecedence = getPrecedence(left);
    let rightPrecedence = getPrecedence(right);

    if (leftPrecedence || rightPrecedence) {
        let leftIndex = leftPrecedence ? precedenceOrder.indexOf(leftPrecedence) : -1;
        let rightIndex = rightPrecedence ? precedenceOrder.indexOf(rightPrecedence) : -1;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    }

    return (left.order ?? 0) - (right.order ?? 0);
}

export function dedupeEntries(entries: NormalizedMetadataEntry[]): NormalizedMetadataEntry[] {
    let byKey = new Map<string, NormalizedMetadataEntry>();

    for (let entry of entries) {
        if (entry.lifecycle === "sticky" && byKey.has(entry.key)) continue;
        byKey.set(entry.key, entry);
    }

    return [...byKey.values()];
}

export function renderHeadEntriesToHtml(
    entries: NormalizedMetadataEntry[],
    options: { precedence?: string[] } = {},
): string {
    let precedenceOrder = collectPrecedenceOrder(entries, options.precedence);

    return dedupeEntries(entries)
        .sort((left, right) => compareEntries(left, right, precedenceOrder))
        .map(renderHeadEntryToHtml)
        .join("");
}
