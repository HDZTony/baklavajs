import type { NodeInterface } from "@baklavajs/core";

export interface EditorBounds {
    left: number;
    top: number;
}

export interface GraphViewportTransform {
    scaling: number;
    panning: { x: number; y: number };
}

export function clientPointToGraphPoint(
    clientX: number,
    clientY: number,
    editorBounds: EditorBounds,
    transform: GraphViewportTransform,
): [number, number] {
    if (transform.scaling <= 0) {
        throw new Error("Graph scaling must be greater than zero");
    }
    return [
        (clientX - editorBounds.left) / transform.scaling - transform.panning.x,
        (clientY - editorBounds.top) / transform.scaling - transform.panning.y,
    ];
}

export function eventPathIncludesEditor(path: EventTarget[], editorEl: HTMLElement): boolean {
    return path.includes(editorEl);
}

export type TemporaryMouseDownAction = "create" | "cancel" | "cancel_and_create" | "ignore";

export type TemporaryMouseUpAction =
    | { type: "none" }
    | { type: "await_target" }
    | { type: "cancel" }
    | { type: "connect" };

/**
 * Decide how pointerdown should affect an in-progress or new temporary connection.
 * Empty-canvas pointerdown cancels an in-progress rubber-band so a lost pointerup cannot leave a void line.
 */
export function resolveTemporaryMouseDownAction(
    hoveringOver: NodeInterface | null,
    hasTemporaryConnection: boolean,
    temporaryFrom: NodeInterface | null,
    awaitingClickTarget: boolean,
): TemporaryMouseDownAction {
    if (!hoveringOver) {
        return hasTemporaryConnection ? "cancel" : "ignore";
    }
    if (!hasTemporaryConnection) {
        return "create";
    }
    if (hoveringOver === temporaryFrom) {
        if (awaitingClickTarget) {
            return "cancel";
        }
        return "ignore";
    }
    if (hoveringOver.isInput) {
        return "ignore";
    }
    return "cancel_and_create";
}

/**
 * Decide how pointerup should complete, await, or cancel a temporary connection.
 */
export function resolveTemporaryMouseUpAction(
    hoveringOver: NodeInterface | null,
    temporaryFrom: NodeInterface,
    awaitingClickTarget: boolean,
): TemporaryMouseUpAction {
    if (!hoveringOver) {
        return { type: "cancel" };
    }
    if (hoveringOver === temporaryFrom) {
        if (awaitingClickTarget) {
            return { type: "cancel" };
        }
        return { type: "await_target" };
    }
    return { type: "connect" };
}
