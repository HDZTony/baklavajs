import type { NodeInterface } from "@baklavajs/core";

export type TemporaryMouseDownAction = "create" | "cancel" | "cancel_and_create" | "ignore";

export type TemporaryMouseUpAction =
    | { type: "none" }
    | { type: "await_target" }
    | { type: "cancel" }
    | { type: "connect" };

/**
 * Decide how pointerdown should affect an in-progress or new temporary connection.
 */
export function resolveTemporaryMouseDownAction(
    hoveringOver: NodeInterface | null,
    hasTemporaryConnection: boolean,
    temporaryFrom: NodeInterface | null,
    awaitingClickTarget: boolean,
): TemporaryMouseDownAction {
    if (!hoveringOver) {
        return "ignore";
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
