import type { AbstractNode } from "@baklavajs/core";

export const VIEWPORT_MARGIN_PX = 500;
export const ESTIMATED_NODE_HEIGHT_PX = 300;

export interface GraphRect {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * Graph-space rectangle visible in the editor, with a screen-pixel margin
 * (converted to graph units). Matches ConnectionView: screen = (gx + pan) * scale.
 */
export function graphViewportInflated(
    editorW: number,
    editorH: number,
    panX: number,
    panY: number,
    scale: number,
    marginScreenPx: number,
): GraphRect {
    const m = marginScreenPx / scale;
    const w = editorW / scale;
    const h = editorH / scale;
    return {
        minX: -panX - m,
        minY: -panY - m,
        maxX: -panX + w + m,
        maxY: -panY + h + m,
    };
}

export function nodeAxisAlignedBox(
    node: AbstractNode,
    defaultWidth: number,
    estimatedHeight = ESTIMATED_NODE_HEIGHT_PX,
): { x1: number; y1: number; x2: number; y2: number } {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const w = node.width ?? defaultWidth;
    return { x1: x, y1: y, x2: x + w, y2: y + estimatedHeight };
}

export function aabbIntersectsRect(
    a: { x1: number; y1: number; x2: number; y2: number },
    b: GraphRect,
): boolean {
    return !(a.x2 < b.minX || a.x1 > b.maxX || a.y2 < b.minY || a.y1 > b.maxY);
}

export function isNodeCollapsed(node: AbstractNode): boolean {
    return !!(node as AbstractNode & { collapsed?: boolean }).collapsed;
}
