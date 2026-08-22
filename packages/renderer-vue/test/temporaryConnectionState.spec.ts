import { describe, expect, it } from "vitest";
import { NodeInterface } from "@baklavajs/core";
import {
    clientPointToGraphPoint,
    eventPathIncludesEditor,
    resolveTemporaryMouseDownAction,
    resolveTemporaryMouseUpAction,
} from "../src/editor/temporaryConnectionState";

describe("temporary connection coordinates", () => {
    it("converts client coordinates relative to the editor bounds", () => {
        expect(
            clientPointToGraphPoint(350, 260, { left: 100, top: 60 }, { scaling: 2, panning: { x: 10, y: 20 } }),
        ).toEqual([115, 80]);
    });

    it("rejects an invalid graph scale", () => {
        expect(() =>
            clientPointToGraphPoint(0, 0, { left: 0, top: 0 }, { scaling: 0, panning: { x: 0, y: 0 } }),
        ).toThrow("Graph scaling must be greater than zero");
    });

    it("matches only the editor that owns the event path", () => {
        const activeEditor = {} as HTMLElement;
        const otherEditor = {} as HTMLElement;
        expect(eventPathIncludesEditor([{}, activeEditor] as EventTarget[], activeEditor)).toBe(true);
        expect(eventPathIncludesEditor([{}, otherEditor] as EventTarget[], activeEditor)).toBe(false);
    });
});

function port(name: string, isInput: boolean) {
    const ni = new NodeInterface(name, 0);
    ni.isInput = isInput;
    return ni;
}

describe("resolveTemporaryMouseDownAction", () => {
    const source = port("out", false);
    const target = port("in", true);
    const otherSource = port("out2", false);

    it("creates when no temporary connection is active", () => {
        expect(resolveTemporaryMouseDownAction(source, false, null, false)).toBe("create");
    });

    it("ignores pointerdown when not hovering a port and no temporary connection exists", () => {
        expect(resolveTemporaryMouseDownAction(null, false, null, false)).toBe("ignore");
    });

    it("cancels an in-progress temporary connection on empty-canvas pointerdown", () => {
        expect(resolveTemporaryMouseDownAction(null, true, source, false)).toBe("cancel");
        expect(resolveTemporaryMouseDownAction(null, true, source, true)).toBe("cancel");
    });

    it("cancels when clicking the same source port while awaiting click target", () => {
        expect(resolveTemporaryMouseDownAction(source, true, source, true)).toBe("cancel");
    });

    it("ignores pointerdown on target port so mouseup can complete click-to-connect", () => {
        expect(resolveTemporaryMouseDownAction(target, true, source, true)).toBe("ignore");
    });

    it("restarts from a new output port while a temporary connection exists", () => {
        expect(resolveTemporaryMouseDownAction(otherSource, true, source, true)).toBe("cancel_and_create");
    });
});

describe("resolveTemporaryMouseUpAction", () => {
    const source = port("out", false);
    const target = port("in", true);

    it("awaits a second click after the first release on the source port", () => {
        expect(resolveTemporaryMouseUpAction(source, source, false)).toEqual({ type: "await_target" });
    });

    it("cancels when the source port is clicked again while awaiting target", () => {
        expect(resolveTemporaryMouseUpAction(source, source, true)).toEqual({ type: "cancel" });
    });

    it("connects when releasing on a different port", () => {
        expect(resolveTemporaryMouseUpAction(target, source, false)).toEqual({ type: "connect" });
    });

    it("cancels when releasing on empty canvas", () => {
        expect(resolveTemporaryMouseUpAction(null, source, false)).toEqual({ type: "cancel" });
    });
});
