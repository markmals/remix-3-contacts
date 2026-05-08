import type { Handle, RemixNode } from "remix/ui";

import type { MetadataElementType, MetadataEntry, MetadataProps } from "./types.ts";

import { createTransportHtml } from "./transport.ts";

export interface HeadProps {
    children?: RemixNode;
    owner?: string;
}

type RemixLikeElement = {
    type: unknown;
    key?: unknown;
    props?: Record<string, unknown>;
};

const SUPPORTED_TYPES = new Set<MetadataElementType>(["title", "meta", "link", "style", "script"]);

function isElement(value: unknown): value is RemixLikeElement {
    return typeof value === "object" && value !== null && "type" in value;
}

function flattenChildren(children: RemixNode): unknown[] {
    if (children === null || children === undefined || typeof children === "boolean") return [];
    if (Array.isArray(children))
        return children.flatMap(child => flattenChildren(child as RemixNode));
    return [children];
}

function textFromChildren(children: unknown): string | undefined {
    if (children === null || children === undefined || typeof children === "boolean")
        return undefined;

    if (Array.isArray(children)) {
        let parts = children
            .map(child => textFromChildren(child))
            .filter((value): value is string => value !== undefined);
        return parts.length === 0 ? undefined : parts.join("");
    }

    if (
        typeof children === "string" ||
        typeof children === "number" ||
        typeof children === "bigint"
    ) {
        return String(children);
    }

    return undefined;
}

function propsFromElement(element: RemixLikeElement): MetadataProps {
    let props: MetadataProps = {};

    for (let [name, value] of Object.entries(element.props ?? {})) {
        if (name === "children") continue;

        if (
            value === null ||
            value === undefined ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            props[name] = value;
        }
    }

    return props;
}

export function entriesFromHeadChildren(children: RemixNode): MetadataEntry[] {
    let entries: MetadataEntry[] = [];
    let order = 0;

    for (let child of flattenChildren(children)) {
        if (!isElement(child)) continue;
        if (typeof child.type !== "string") continue;
        if (!SUPPORTED_TYPES.has(child.type as MetadataElementType)) continue;

        let entry: MetadataEntry = {
            type: child.type as MetadataElementType,
            props: propsFromElement(child),
            order,
        };

        if (typeof child.key === "string" || typeof child.key === "number") {
            entry.key = String(child.key);
        }

        let childrenText = textFromChildren(child.props?.children);
        if (childrenText !== undefined) {
            entry.children = childrenText;
        }

        entries.push(entry);
        order++;
    }

    return entries;
}

export function Head(handle: Handle<HeadProps>) {
    return () => {
        let owner = handle.props.owner ?? handle.id;
        let entries = entriesFromHeadChildren(handle.props.children);
        let html = createTransportHtml({ owner, entries });

        return (
            <template
                data-pitlane-metadata="true"
                data-pitlane-metadata-owner={owner}
                innerHTML={html.replace(/^<template\b[^>]*>/i, "").replace(/<\/template>$/i, "")}
            />
        );
    };
}
