/**
 * Merges all connection coordinate updates in a frame into a single
 * requestAnimationFrame so layout (offsetTop/offsetLeft) is read at most once
 * per paint for the whole connection layer.
 */
let rafId: number | null = null;
const pending = new Set<() => void>();

export function scheduleConnectionLayoutRead(fn: () => void): void {
    pending.add(fn);
    if (rafId !== null) {
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
