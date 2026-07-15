/**
 * Merges all connection coordinate updates in a frame into a single
 * requestAnimationFrame so layout (offsetTop/offsetLeft) is read at most once
 * per paint for the whole connection layer.
 */
let rafId: number | null = null;
const pending = new Set<() => void>();
const refreshCallbacks = new Set<() => void>();
const refreshCallbacksByNodeId = new Map<string, Set<() => void>>();

function requestLayoutFrame(): void {
    if (rafId !== null || pending.size === 0) {
        return;
    }
    rafId = requestAnimationFrame(() => {
        rafId = null;
        const batch = Array.from(pending);
        pending.clear();
        for (const f of batch) {
            f();
        }
    });
}

export function scheduleConnectionLayoutRead(fn: () => void): void {
    pending.add(fn);
    requestLayoutFrame();
}

export function subscribeConnectionLayoutRefresh(nodeIds: readonly string[], fn: () => void): () => void {
    refreshCallbacks.add(fn);
    const ids = Array.from(new Set(nodeIds.map((id) => id.trim()).filter(Boolean)));
    for (const id of ids) {
        const callbacks = refreshCallbacksByNodeId.get(id) ?? new Set<() => void>();
        callbacks.add(fn);
        refreshCallbacksByNodeId.set(id, callbacks);
    }

    return () => {
        refreshCallbacks.delete(fn);
        for (const id of ids) {
            const callbacks = refreshCallbacksByNodeId.get(id);
            callbacks?.delete(fn);
            if (callbacks?.size === 0) {
                refreshCallbacksByNodeId.delete(id);
            }
        }
        pending.delete(fn);
    };
}

export function requestConnectionLayoutRefreshForNode(nodeId: string): void {
    const callbacks = refreshCallbacksByNodeId.get(nodeId.trim());
    if (!callbacks) {
        return;
    }
    for (const callback of callbacks) {
        pending.add(callback);
    }
    requestLayoutFrame();
}

export function forceConnectionLayoutRefresh(): void {
    for (const callback of refreshCallbacks) {
        pending.add(callback);
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    requestLayoutFrame();
}
