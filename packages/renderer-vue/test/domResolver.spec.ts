import { afterEach, describe, expect, it, vi } from "vitest";

import { getDomElementById } from "../src/connection/domResolver";

describe("getDomElementById", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("queries only within the supplied editor root", () => {
        const globalElement = { id: "duplicate-id", owner: "hidden-editor" };
        const scopedElement = { id: "duplicate-id", owner: "active-editor" };
        const getElementById = vi.fn(() => globalElement);
        const querySelector = vi.fn(() => scopedElement);
        const fakeDocument = { getElementById };
        const editorRoot = { querySelector };

        vi.stubGlobal("document", fakeDocument);
        vi.stubGlobal("CSS", { escape: (id: string) => id });

        expect(getDomElementById("duplicate-id", editorRoot as unknown as ParentNode)).toBe(scopedElement);
        expect(querySelector).toHaveBeenCalledWith("#duplicate-id");
        expect(getElementById).not.toHaveBeenCalled();
    });

    it("preserves document-wide lookup when no editor root is supplied", () => {
        const globalElement = { id: "node-id" };
        const getElementById = vi.fn(() => globalElement);
        const fakeDocument = { getElementById };

        vi.stubGlobal("document", fakeDocument);

        expect(getDomElementById("node-id")).toBe(globalElement);
        expect(getElementById).toHaveBeenCalledWith("node-id");
    });
});
