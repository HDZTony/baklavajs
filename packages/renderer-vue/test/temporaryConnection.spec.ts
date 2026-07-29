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
});
