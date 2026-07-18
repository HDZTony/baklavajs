import { inject, onScopeDispose, provide, ref, Ref, watch } from "vue";
import { NodeInterface } from "@baklavajs/core";
import { ITemporaryConnection, TemporaryConnectionState } from "../connection/connection";
import { useGraph } from "../utility";
import {
    clientPointToGraphPoint,
    eventPathIncludesEditor,
    resolveTemporaryMouseDownAction,
    resolveTemporaryMouseUpAction,
} from "./temporaryConnectionState";

const TEMPORARY_CONNECTION_HANDLER_INJECTION_SYMBOL = Symbol();
export interface ITemporaryConnectionHandler {
    hoveredOver: (ni: NodeInterface | undefined) => void;
    temporaryConnection: Ref<ITemporaryConnection | null>;
    cancelTemporaryConnection: () => void;
}

export function provideTemporaryConnection(editorElRef?: Ref<HTMLElement | null>) {
    const { graph } = useGraph();
    const editorEl = editorElRef ?? inject<Ref<HTMLElement | null>>("editorEl");
    if (!editorEl) {
        throw new Error("provideTemporaryConnection must be used within a BaklavaEditor");
    }

    const temporaryConnection = ref<ITemporaryConnection | null>(null) as Ref<ITemporaryConnection | null>;
    const hoveringOver = ref<NodeInterface | null>(null) as Ref<NodeInterface | null>;
    const awaitingClickTarget = ref(false);

    const clearConnectionDangerFlags = () => {
        graph.value.connections.forEach((c) => {
            c.isInDanger = false;
        });
    };

    const cancelTemporaryConnection = () => {
        temporaryConnection.value = null;
        awaitingClickTarget.value = false;
        clearConnectionDangerFlags();
    };

    const beginTemporaryConnection = (from: NodeInterface) => {
        const connection = graph.value.connections.find((c) => c.to === from);
        if (from.isInput && connection) {
            temporaryConnection.value = {
                status: TemporaryConnectionState.NONE,
                from: connection.from,
            };
            graph.value.removeConnection(connection);
        } else {
            temporaryConnection.value = {
                status: TemporaryConnectionState.NONE,
                from,
            };
        }

        temporaryConnection.value.mx = undefined;
        temporaryConnection.value.my = undefined;
        awaitingClickTarget.value = false;
    };

    const onPointerMove = (ev: PointerEvent) => {
        if (temporaryConnection.value) {
            const root = editorEl.value;
            if (!root) {
                cancelTemporaryConnection();
                return;
            }
            const [x, y] = clientPointToGraphPoint(ev.clientX, ev.clientY, root.getBoundingClientRect(), graph.value);
            temporaryConnection.value.mx = x;
            temporaryConnection.value.my = y;
        }
    };

    const onMouseDown = () => {
        const action = resolveTemporaryMouseDownAction(
            hoveringOver.value,
            !!temporaryConnection.value,
            temporaryConnection.value?.from ?? null,
            awaitingClickTarget.value,
        );

        if (action === "ignore") {
            return;
        }
        if (action === "cancel") {
            cancelTemporaryConnection();
            return;
        }
        if (action === "cancel_and_create" || action === "create") {
            if (action === "cancel_and_create") {
                cancelTemporaryConnection();
            }
            if (hoveringOver.value) {
                beginTemporaryConnection(hoveringOver.value);
            }
        }
    };

    const onMouseUp = () => {
        if (!temporaryConnection.value) {
            return;
        }

        const upAction = resolveTemporaryMouseUpAction(
            hoveringOver.value,
            temporaryConnection.value.from,
            awaitingClickTarget.value,
        );

        if (upAction.type === "none") {
            return;
        }
        if (upAction.type === "await_target") {
            awaitingClickTarget.value = true;
            return;
        }
        if (upAction.type === "connect" && hoveringOver.value) {
            graph.value.addConnection(temporaryConnection.value.from, hoveringOver.value);
        }
        cancelTemporaryConnection();
    };

    const hoveredOver = (ni: NodeInterface | undefined) => {
        hoveringOver.value = ni ?? null;
        if (ni && temporaryConnection.value) {
            temporaryConnection.value.to = ni;
            const checkConnectionResult = graph.value.checkConnection(
                temporaryConnection.value.from,
                temporaryConnection.value.to,
            );
            temporaryConnection.value.status = checkConnectionResult.connectionAllowed
                ? TemporaryConnectionState.ALLOWED
                : TemporaryConnectionState.FORBIDDEN;

            if (checkConnectionResult.connectionAllowed) {
                const ids = checkConnectionResult.connectionsInDanger.map((c) => c.id);
                graph.value.connections.forEach((c) => {
                    if (ids.includes(c.id)) {
                        c.isInDanger = true;
                    }
                });
            }
        } else if (!ni && temporaryConnection.value) {
            temporaryConnection.value.to = undefined;
            temporaryConnection.value.status = TemporaryConnectionState.NONE;
            clearConnectionDangerFlags();
        }
    };

    const onDocumentPointerUp = (ev: PointerEvent) => {
        if (!temporaryConnection.value) {
            return;
        }
        const root = editorEl.value;
        if (root && eventPathIncludesEditor(ev.composedPath(), root)) {
            onMouseUp();
            return;
        }
        cancelTemporaryConnection();
    };

    const onDocumentPointerCancel = () => {
        cancelTemporaryConnection();
    };

    const onDocumentKeyDown = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape" || !temporaryConnection.value) {
            return;
        }
        cancelTemporaryConnection();
        ev.preventDefault();
        ev.stopPropagation();
    };

    const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
            cancelTemporaryConnection();
        }
    };

    const onWindowBlur = () => {
        cancelTemporaryConnection();
    };

    watch(
        temporaryConnection,
        (tc, _prev, onCleanup) => {
            if (!tc) {
                return;
            }
            document.addEventListener("pointermove", onPointerMove, true);
            document.addEventListener("pointerup", onDocumentPointerUp, true);
            document.addEventListener("pointercancel", onDocumentPointerCancel, true);
            document.addEventListener("keydown", onDocumentKeyDown, true);
            document.addEventListener("visibilitychange", onVisibilityChange);
            window.addEventListener("blur", onWindowBlur);
            onCleanup(() => {
                document.removeEventListener("pointermove", onPointerMove, true);
                document.removeEventListener("pointerup", onDocumentPointerUp, true);
                document.removeEventListener("pointercancel", onDocumentPointerCancel, true);
                document.removeEventListener("keydown", onDocumentKeyDown, true);
                document.removeEventListener("visibilitychange", onVisibilityChange);
                window.removeEventListener("blur", onWindowBlur);
            });
        },
        { flush: "sync" },
    );

    onScopeDispose(() => {
        cancelTemporaryConnection();
    });

    provide<ITemporaryConnectionHandler>(TEMPORARY_CONNECTION_HANDLER_INJECTION_SYMBOL, {
        temporaryConnection,
        hoveredOver,
        cancelTemporaryConnection,
    });

    return {
        temporaryConnection,
        onMouseDown,
        onMouseUp,
        hoveredOver,
        cancelTemporaryConnection,
    };
}

export function useTemporaryConnection() {
    const temporaryConnection = inject<ITemporaryConnectionHandler>(TEMPORARY_CONNECTION_HANDLER_INJECTION_SYMBOL);
    if (!temporaryConnection) {
        throw new Error("useTemporaryConnection must be used within a BaklavaEditor");
    }
    return temporaryConnection;
}
