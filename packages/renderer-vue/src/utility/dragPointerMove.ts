/** Click vs drag: ignore sub-pixel jitter and modifier-key ghost moves. */
export const NODE_DRAG_THRESHOLD_PX = 4;

export type DragPointerMoveDecision = "end" | "ignore" | "move";

export type DragPointerMoveEvent = {
    buttons: number;
    movementX?: number;
    movementY?: number;
    pageX: number;
    pageY: number;
};

/**
 * Decide whether a pointermove should move a node / pan the canvas.
 *
 * Chromium on Windows synthesizes `pointermove` when Shift/Ctrl/Alt is pressed.
 * Those events report `movementX/Y === 0` but can carry a different `pageX/Y`,
 * which previously jumped selected nodes (or panned the whole graph).
 */
export function decideDragPointerMove(
    ev: DragPointerMoveEvent,
    start: { x: number; y: number },
    passedThreshold: boolean,
    thresholdPx: number = NODE_DRAG_THRESHOLD_PX,
): DragPointerMoveDecision {
    if (ev.buttons === 0) {
        return "end";
    }
    if (ev.movementX === 0 && ev.movementY === 0) {
        return "ignore";
    }
    if (passedThreshold) {
        return "move";
    }
    const dx = ev.pageX - start.x;
    const dy = ev.pageY - start.y;
    if (dx * dx + dy * dy < thresholdPx * thresholdPx) {
        return "ignore";
    }
    return "move";
}
