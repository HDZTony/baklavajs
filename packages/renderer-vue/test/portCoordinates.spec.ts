import { describe, expect, it } from "vitest";

import { getPortCoordinates, resolveTemporaryConnectionPaint } from "../src/connection/portCoordinates";

function mockEl(partial: {
    offsetLeft?: number;
    offsetTop?: number;
    clientWidth?: number;
    clientHeight?: number;
    offsetParent?: Element | null;
}): HTMLElement {
    return {
        offsetLeft: partial.offsetLeft ?? 0,
        offsetTop: partial.offsetTop ?? 0,
        clientWidth: partial.clientWidth ?? 10,
        clientHeight: partial.clientHeight ?? 10,
        offsetParent: partial.offsetParent ?? null,
    } as HTMLElement;
}

describe("getPortCoordinates", () => {
    it("returns null when the port DOM is unresolved", () => {
        expect(
            getPortCoordinates({
                node: mockEl({ offsetLeft: 100, offsetTop: 50 }),
                interface: mockEl({}),
                port: null,
            }),
        ).toBeNull();
        expect(getPortCoordinates({ node: null, interface: null, port: null })).toBeNull();
    });

    it("returns the port center in node-container space, not the graph origin", () => {
        const node = mockEl({ offsetLeft: 100, offsetTop: 200 });
        const port = mockEl({
            offsetLeft: 10,
            offsetTop: 20,
            clientWidth: 10,
            clientHeight: 10,
            offsetParent: node,
        });
        expect(
            getPortCoordinates({
                node,
                interface: mockEl({}),
                port,
            }),
        ).toEqual([115, 225]);
    });
});

describe("resolveTemporaryConnectionPaint", () => {
    it("returns null when the source port is unresolved", () => {
        expect(resolveTemporaryConnectionPaint(null, null, 40, 50, false)).toBeNull();
        expect(resolveTemporaryConnectionPaint(null, [10, 10], 40, 50, true)).toBeNull();
    });

    it("uses mouse graph coordinates when the target port is missing", () => {
        expect(resolveTemporaryConnectionPaint([10, 20], null, 40, 50, false)).toEqual({
            input: [10, 20],
            output: [40, 50],
        });
        expect(resolveTemporaryConnectionPaint([10, 20], null, 40, 50, true)).toEqual({
            input: [40, 50],
            output: [10, 20],
        });
    });
});
