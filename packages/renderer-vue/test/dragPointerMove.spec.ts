import { describe, expect, it } from "vitest";
import { decideDragPointerMove, NODE_DRAG_THRESHOLD_PX } from "../src/utility/dragPointerMove";

const start = { x: 100, y: 200 };

describe("decideDragPointerMove", () => {
    it("ends the drag when no mouse button is held", () => {
        expect(
            decideDragPointerMove({ buttons: 0, movementX: 3, movementY: 0, pageX: 140, pageY: 200 }, start, false),
        ).toBe("end");
    });

    it("ignores Chromium Shift/Ctrl/Alt ghost moves (movement 0, page coordinates jumped)", () => {
        expect(
            decideDragPointerMove({ buttons: 1, movementX: 0, movementY: 0, pageX: 180, pageY: 260 }, start, false),
        ).toBe("ignore");
        expect(
            decideDragPointerMove({ buttons: 1, movementX: 0, movementY: 0, pageX: 180, pageY: 260 }, start, true),
        ).toBe("ignore");
    });

    it("ignores movement below the drag threshold", () => {
        expect(
            decideDragPointerMove(
                {
                    buttons: 1,
                    movementX: 1,
                    movementY: 0,
                    pageX: start.x + NODE_DRAG_THRESHOLD_PX - 1,
                    pageY: start.y,
                },
                start,
                false,
            ),
        ).toBe("ignore");
    });

    it("moves once the pointer travels past the threshold", () => {
        expect(
            decideDragPointerMove(
                {
                    buttons: 1,
                    movementX: NODE_DRAG_THRESHOLD_PX,
                    movementY: 0,
                    pageX: start.x + NODE_DRAG_THRESHOLD_PX,
                    pageY: start.y,
                },
                start,
                false,
            ),
        ).toBe("move");
    });

    it("keeps moving after the threshold without requiring extra distance", () => {
        expect(
            decideDragPointerMove(
                { buttons: 1, movementX: 1, movementY: 0, pageX: start.x + 1, pageY: start.y },
                start,
                true,
            ),
        ).toBe("move");
    });

    it("does not treat missing movementX as a modifier ghost (fallback to distance)", () => {
        expect(
            decideDragPointerMove({ buttons: 1, pageX: start.x + NODE_DRAG_THRESHOLD_PX, pageY: start.y }, start, false),
        ).toBe("move");
    });
});
