import { computed, Ref, ref } from "vue";
import { decideDragPointerMove } from "./dragPointerMove";
import { useGraph } from "./useGraph";

interface IPosition {
    x: number;
    y: number;
}

export function useDragMove(positionRef: Ref<IPosition>) {
    const { graph } = useGraph();
    const draggingStartPoint = ref<IPosition | null>(null);
    const draggingStartPosition = ref<IPosition | null>(null);
    let captureElement: Element | null = null;
    let capturePointerId: number | null = null;
    let passedThreshold = false;

    const dragging = computed(() => !!draggingStartPoint.value);

    const onPointerDown = (ev: PointerEvent) => {
        passedThreshold = false;
        draggingStartPoint.value = {
            x: ev.pageX,
            y: ev.pageY,
        };
        draggingStartPosition.value = {
            x: positionRef.value.x,
            y: positionRef.value.y,
        };
        const t = ev.target;
        if (t instanceof Element && typeof t.setPointerCapture === "function") {
            try {
                t.setPointerCapture(ev.pointerId);
                captureElement = t;
                capturePointerId = ev.pointerId;
            } catch {
                captureElement = null;
                capturePointerId = null;
            }
        }
    };

    const onPointerUp = (ev?: PointerEvent) => {
        if (captureElement && typeof captureElement.releasePointerCapture === "function") {
            const pid = ev?.pointerId ?? capturePointerId;
            if (pid != null) {
                try {
                    captureElement.releasePointerCapture(pid);
                } catch {
                    /* ignore */
                }
            }
        }
        captureElement = null;
        capturePointerId = null;
        passedThreshold = false;
        draggingStartPoint.value = null;
        draggingStartPosition.value = null;
    };

    const onPointerMove = (ev: PointerEvent) => {
        const start = draggingStartPoint.value;
        if (!start || !draggingStartPosition.value) {
            return;
        }
        const decision = decideDragPointerMove(ev, start, passedThreshold);
        if (decision === "end") {
            onPointerUp(ev);
            return;
        }
        if (decision === "ignore") {
            return;
        }
        passedThreshold = true;
        const dx = ev.pageX - start.x;
        const dy = ev.pageY - start.y;
        positionRef.value.x = draggingStartPosition.value.x + dx / graph.value.scaling;
        positionRef.value.y = draggingStartPosition.value.y + dy / graph.value.scaling;
    };

    return { dragging, onPointerDown, onPointerMove, onPointerUp };
}
