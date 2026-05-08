import type { MetadataEntry } from "./types.ts";

export interface MetadataTransportPayload {
    owner: string;
    entries: MetadataEntry[];
}

function escapeAttribute(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function decodeAttribute(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&");
}

function safeJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

const TEMPLATE_RE =
    /<template\b(?=[^>]*\bdata-pitlane-metadata=["']true["'])([^>]*)>([\s\S]*?)<\/template>/gi;

const OWNER_RE = /\bdata-pitlane-metadata-owner=["']([^"']+)["']/i;

const JSON_RE = /<script\b(?=[^>]*\bdata-pitlane-metadata-json\b)[^>]*>([\s\S]*?)<\/script>/i;

export function createTransportHtml(payload: MetadataTransportPayload): string {
    return `<template data-pitlane-metadata="true" data-pitlane-metadata-owner="${escapeAttribute(
        payload.owner,
    )}"><script type="application/json" data-pitlane-metadata-json>${safeJson(
        payload.entries,
    )}</script></template>`;
}

export function parseTransportTemplate(templateHtml: string): MetadataTransportPayload | null {
    let open = templateHtml.match(/^<template\b([^>]*)>/i);
    if (!open) return null;

    let ownerMatch = open[1].match(OWNER_RE);
    if (!ownerMatch) return null;

    let jsonMatch = templateHtml.match(JSON_RE);
    if (!jsonMatch) return null;

    try {
        let entries = JSON.parse(jsonMatch[1]) as MetadataEntry[];
        if (!Array.isArray(entries)) return null;
        return { owner: decodeAttribute(ownerMatch[1]), entries };
    } catch {
        return null;
    }
}

export function extractTransportTemplates(html: string): MetadataTransportPayload[] {
    let payloads: MetadataTransportPayload[] = [];

    for (let match of html.matchAll(TEMPLATE_RE)) {
        let payload = parseTransportTemplate(match[0]);
        if (payload) payloads.push(payload);
    }

    return payloads;
}

export function stripTransportTemplates(html: string): string {
    return html.replace(TEMPLATE_RE, "");
}
