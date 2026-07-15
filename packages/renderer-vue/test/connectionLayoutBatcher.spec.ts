import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    forceConnectionLayoutRefresh,
    requestConnectionLayoutRefreshForNode,
    scheduleConnectionLayoutRead,
    subscribeConnectionLayoutRefresh,
} from "../src/connection/connectionLayoutBatcher";

let nextFrameId: number;
let frames: Map<number, FrameRequestCallback>;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

function runFrame(id = Math.max(...frames.keys())): void {
    const callback = frames.get(id);
    if (!callback) {
        throw new Error(`Frame ${id} is not scheduled`);
    }
    frames.delete(id);
    callback(0);
}

beforeEach(() => {
    nextFrameId = 1;
    frames = new Map();
    requestFrame = vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrameId++;
        frames.set(id, callback);
        return id;
    });
    cancelFrame = vi.fn((id: number) => {
        frames.delete(id);
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("connectionLayoutBatcher", () => {
    it("deduplicates the same layout read within one frame", () => {
        const callback = vi.fn();

        scheduleConnectionLayoutRead(callback);
        scheduleConnectionLayoutRead(callback);

        expect(requestFrame).toHaveBeenCalledTimes(1);
        runFrame();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("refreshes only connections registered for the changed node", () => {
        const adjacent = vi.fn();
        const unrelated = vi.fn();
        const unsubscribeAdjacent = subscribeConnectionLayoutRefresh(["a", "b"], adjacent);
        const unsubscribeUnrelated = subscribeConnectionLayoutRefresh(["c"], unrelated);

        requestConnectionLayoutRefreshForNode("a");
        runFrame();

        expect(adjacent).toHaveBeenCalledTimes(1);
        expect(unrelated).not.toHaveBeenCalled();
        unsubscribeAdjacent();
        unsubscribeUnrelated();
    });

    it("refreshes every registered connection after resume", () => {
        const first = vi.fn();
        const second = vi.fn();
        const unsubscribeFirst = subscribeConnectionLayoutRefresh(["a"], first);
        const unsubscribeSecond = subscribeConnectionLayoutRefresh(["b"], second);

        forceConnectionLayoutRefresh();
        runFrame();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        unsubscribeFirst();
        unsubscribeSecond();
    });

    it("cancels a stale frame and reschedules pending reads after resume", () => {
        const pendingRead = vi.fn();
        const registeredRefresh = vi.fn();
        const unsubscribe = subscribeConnectionLayoutRefresh(["a"], registeredRefresh);

        scheduleConnectionLayoutRead(pendingRead);
        const staleFrameId = 1;
        forceConnectionLayoutRefresh();

        expect(cancelFrame).toHaveBeenCalledWith(staleFrameId);
        expect(requestFrame).toHaveBeenCalledTimes(2);
        runFrame();
        expect(pendingRead).toHaveBeenCalledTimes(1);
        expect(registeredRefresh).toHaveBeenCalledTimes(1);
        unsubscribe();
    });

    it("does not invoke a refresh callback after unsubscribe", () => {
        const callback = vi.fn();
        const unsubscribe = subscribeConnectionLayoutRefresh(["a"], callback);

        requestConnectionLayoutRefreshForNode("a");
        unsubscribe();
        runFrame();

        expect(callback).not.toHaveBeenCalled();
    });
});
