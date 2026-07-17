<template>
    <connection-view :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" :state="state" />
</template>

<script lang="ts">
import { computed, defineComponent, inject, ref, onBeforeUnmount, onMounted, nextTick, watch, Ref } from "vue";
import { Connection } from "@baklavajs/core";
import ConnectionView from "./ConnectionView.vue";
import { getDomElementById, getDomElements, IResolvedDomElements } from "./domResolver";
import {
    scheduleConnectionLayoutRead,
    subscribeConnectionLayoutRefresh,
} from "./connectionLayoutBatcher";
import type { NodeInterface } from "@baklavajs/core";
import { TemporaryConnectionState } from "./connection";
import { useGraph } from "../utility";

export default defineComponent({
    components: {
        "connection-view": ConnectionView,
    },
    props: {
        connection: {
            type: Object as () => Connection,
            required: true,
        },
    },
    setup(props) {
        const { graph } = useGraph();
        const editorEl = inject<Ref<HTMLElement | null>>("editorEl");
        if (!editorEl) {
            throw new Error("ConnectionWrapper must be used within a BaklavaEditor");
        }

        let resizeObserver: ResizeObserver | undefined;
        let unsubscribeLayoutRefresh: (() => void) | undefined;
        const d = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });

        const state = computed(() =>
            props.connection.isInDanger ? TemporaryConnectionState.FORBIDDEN : TemporaryConnectionState.NONE,
        );

        const fromNodePosition = computed(() => graph.value.findNodeById(props.connection.from.nodeId)?.position);
        const toNodePosition = computed(() => graph.value.findNodeById(props.connection.to.nodeId)?.position);

        const portFallbackOnNode = (ni: NodeInterface, resolved: IResolvedDomElements): [number, number] | null => {
            if (resolved.node) {
                return [
                    resolved.node.offsetLeft + resolved.node.offsetWidth * 0.5,
                    resolved.node.offsetTop + resolved.node.offsetHeight * 0.5,
                ];
            }
            const el = editorEl.value ? getDomElementById(ni.nodeId, editorEl.value) : null;
            if (el) {
                return [el.offsetLeft + el.offsetWidth * 0.5, el.offsetTop + el.offsetHeight * 0.5];
            }
            return null;
        };

        const getPortCoordinates = (ni: NodeInterface, resolved: IResolvedDomElements): [number, number] => {
            if (resolved.node && resolved.interface && resolved.port) {
                let x = resolved.port.offsetLeft + resolved.port.clientWidth / 2;
                let y = resolved.port.offsetTop + resolved.port.clientHeight / 2;
                let cur: Element | null = resolved.port.offsetParent;
                while (cur && cur !== resolved.node) {
                    const ce = cur as HTMLElement;
                    x += ce.offsetLeft;
                    y += ce.offsetTop;
                    cur = ce.offsetParent;
                }
                x += resolved.node.offsetLeft;
                y += resolved.node.offsetTop;
                return [x, y];
            }
            return portFallbackOnNode(ni, resolved) ?? [0, 0];
        };

        const updateCoords = () => {
            const root = editorEl.value;
            if (!root) {
                return;
            }
            const from = getDomElements(props.connection.from, root);
            const to = getDomElements(props.connection.to, root);
            if (from.node && to.node) {
                if (!resizeObserver) {
                    resizeObserver = new ResizeObserver(() => {
                        scheduleUpdate();
                    });
                    resizeObserver.observe(from.node);
                    resizeObserver.observe(to.node);
                }
            }
            const [x1, y1] = getPortCoordinates(props.connection.from, from);
            const [x2, y2] = getPortCoordinates(props.connection.to, to);
            d.value = { x1, y1, x2, y2 };
        };

        let alive = true;

        const scheduleUpdate = () => {
            scheduleConnectionLayoutRead(() => {
                if (!alive) {
                    return;
                }
                updateCoords();
            });
        };

        onMounted(async () => {
            unsubscribeLayoutRefresh = subscribeConnectionLayoutRefresh(
                [props.connection.from.nodeId, props.connection.to.nodeId],
                updateCoords,
            );
            await nextTick();
            updateCoords();
        });

        onBeforeUnmount(() => {
            alive = false;
            unsubscribeLayoutRefresh?.();
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        });

        watch([fromNodePosition, toNodePosition], () => scheduleUpdate(), { deep: true });

        return { d, state };
    },
});
</script>
