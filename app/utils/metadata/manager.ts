import { dedupeEntries, renderHeadEntryToHtml } from "./html.ts";
import { normalizeEntry } from "./rules.ts";
import type { MetadataManagerOptions, NormalizedMetadataEntry } from "./types.ts";

interface ExistingManagedNode {
    node: Element;
    owner: string;
    key: string;
    lifecycle: "replaceable" | "sticky";
}

function cssEscape(value: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
    }

    return value.replace(/["\\]/g, "\\$&");
}

function parseTemplateElement(template: HTMLTemplateElement): NormalizedMetadataEntry[] {
    let owner = template.getAttribute("data-pitlane-metadata-owner");
    if (!owner) return [];

    let json = template.content.querySelector("[data-pitlane-metadata-json]")?.textContent;
    if (!json) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return [];
    }

    if (!Array.isArray(parsed)) return [];

    let entries: NormalizedMetadataEntry[] = [];

    for (let raw of parsed) {
        if (typeof raw !== "object" || raw === null) continue;
        let normalized = normalizeEntry({
            ...(raw as NormalizedMetadataEntry),
            owner,
        });

        if (normalized) entries.push(normalized);
    }

    return entries;
}

function nodeToManaged(node: Element): ExistingManagedNode | null {
    let owner = node.getAttribute("data-pitlane-metadata-owner");
    let key = node.getAttribute("data-pitlane-metadata-key");
    let lifecycle: ExistingManagedNode["lifecycle"] =
        node.getAttribute("data-pitlane-metadata-lifecycle") === "sticky"
            ? "sticky"
            : "replaceable";

    if (!owner || !key) return null;

    return { node, owner, key, lifecycle };
}

function domNodeFromHtml(document: Document, html: string): Element {
    let range = document.createRange();
    range.selectNodeContents(document.head);
    let fragment = range.createContextualFragment(html);
    let node = fragment.firstElementChild;
    if (!node) throw new Error("Could not create metadata DOM node from HTML");

    return node;
}

export class MetadataManager {
    #document: Document | null = null;
    #observer: MutationObserver | null = null;
    #scheduled = false;
    #options: MetadataManagerOptions;

    constructor(options: MetadataManagerOptions = {}) {
        this.#options = options;
    }

    hydrate(document: Document = window.document): void {
        this.dispose();
        this.#document = document;
        this.sync();

        this.#observer = new MutationObserver(() => {
            this.#scheduleSync();
        });

        this.#observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    dispose(): void {
        this.#observer?.disconnect();
        this.#observer = null;
        this.#document = null;
        this.#scheduled = false;
    }

    #scheduleSync(): void {
        if (this.#scheduled) return;
        this.#scheduled = true;

        queueMicrotask(() => {
            this.#scheduled = false;
            this.sync();
        });
    }

    sync(): void {
        let document = this.#document;
        if (!document) return;

        let desiredEntries = dedupeEntries(this.#readActiveEntries(document));
        let desiredKeys = new Set(
            desiredEntries.map(entry => `${entry.owner ?? "document"}:${entry.key}`),
        );

        let existing = [...document.head.querySelectorAll('[data-pitlane-metadata-managed="true"]')]
            .map(nodeToManaged)
            .filter((value): value is ExistingManagedNode => value !== null);

        for (let item of existing) {
            let fullKey = `${item.owner}:${item.key}`;
            if (desiredKeys.has(fullKey)) continue;
            if (item.lifecycle === "sticky") continue;
            item.node.remove();
        }

        for (let entry of desiredEntries) {
            this.#upsertEntry(document, entry);
        }
    }

    #readActiveEntries(document: Document): NormalizedMetadataEntry[] {
        let entries: NormalizedMetadataEntry[] = [];

        for (let template of document.querySelectorAll<HTMLTemplateElement>(
            'template[data-pitlane-metadata="true"]',
        )) {
            entries.push(...parseTemplateElement(template));
        }

        return entries;
    }

    #upsertEntry(document: Document, entry: NormalizedMetadataEntry): void {
        let owner = entry.owner ?? "document";
        let selector = `[data-pitlane-metadata-managed="true"][data-pitlane-metadata-owner="${cssEscape(
            owner,
        )}"][data-pitlane-metadata-key="${cssEscape(entry.key)}"]`;

        let current = document.head.querySelector(selector);
        let next = domNodeFromHtml(document, renderHeadEntryToHtml(entry));

        if (current) {
            if (current.outerHTML !== next.outerHTML) {
                current.replaceWith(next);
            }
            return;
        }

        document.head.appendChild(next);
    }
}

export function createMetadataManager(options: MetadataManagerOptions = {}): MetadataManager {
    return new MetadataManager(options);
}
