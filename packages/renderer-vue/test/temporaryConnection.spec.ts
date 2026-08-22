import { effectScope, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utility/useGraph", () => ({
    useGraph: () => ({
        graph: ref({
            connections: [],
            panning: { x: 0, y: 0 },
            scaling: 1,
            addConnection: vi.fn(),
            removeConnection: vi.fn(),
            checkConnection: vi.fn(() => ({ connectionAllowed: false, connectionsInDanger: [] })),
        }),
        switchGraph: vi.fn(),
    }),
}));

import { provideTemporaryConnection } from "../src/editor/temporaryConnection";

describe("provideTemporaryConnection", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("requires an editor element ref (no inject fallback)", () => {
        expect(() =>
            provideTemporaryConnection(undefined as unknown as ReturnType<typeof ref<HTMLElement | null>>),
        ).toThrow("provideTemporaryConnection requires the BaklavaEditor root element ref");
    });

    it("creates a handler when the editor element ref is passed explicitly", () => {
        const scope = effectScope(true);
        let temporaryConnection: ReturnType<typeof provideTemporaryConnection> | undefined;
        scope.run(() => {
            const editorEl = ref<HTMLElement | null>(null);
            temporaryConnection = provideTemporaryConnection(editorEl);
        });
        expect(temporaryConnection).toBeDefined();
        expect(temporaryConnection!.temporaryConnection.value).toBeNull();
        expect(typeof temporaryConnection!.cancelTemporaryConnection).toBe("function");
        expect(typeof temporaryConnection!.hoveredOver).toBe("function");
        scope.stop();
    });

    it("clears the temporary connection on cancel", () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        vi.stubGlobal("document", { addEventListener, removeEventListener });
        vi.stubGlobal("window", { addEventListener, removeEventListener });

        const scope = effectScope(true);
        let temporaryConnection: ReturnType<typeof provideTemporaryConnection> | undefined;
        scope.run(() => {
            const editorEl = ref<HTMLElement | null>(null);
            temporaryConnection = provideTemporaryConnection(editorEl);
        });
        temporaryConnection!.temporaryConnection.value = {
            status: 0,
            from: { isInput: false } as never,
        };
        temporaryConnection!.cancelTemporaryConnection();
        expect(temporaryConnection!.temporaryConnection.value).toBeNull();
        scope.stop();
    });
});
