<template>
    <div
        ref="el"
        tabindex="-1"
        class="baklava-editor"
        :class="{
            'baklava-ignore-mouse': !!temporaryConnection.temporaryConnection.value || panZoom.dragging.value,
            '--temporary-connection': !!temporaryConnection.temporaryConnection.value,
            '--start-selection-box': selectionBox.startSelection,
        }"
        @pointermove.self="onPointerMove"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @wheel.self="panZoom.onMouseWheel"
        @keydown="keyDown"
        @keyup="keyUp"
        @contextmenu.self="contextMenu.open"
    >
        <slot name="background">
            <Background />
        </slot>

        <slot name="toolbar">
            <Toolbar v-if="viewModel.settings.toolbar.enabled" />
        </slot>

        <slot name="palette">
            <NodePalette v-if="viewModel.settings.palette.enabled" />
        </slot>

        <svg class="connections-container">
            <g v-for="connection in visibleConnections" :key="connection.id + counter.toString()">
                <slot name="connection" :connection="connection">
                    <ConnectionWrapper :connection="connection" />
                </slot>
            </g>
            <slot name="temporaryConnection" :temporary-connection="temporaryConnection.temporaryConnection.value">
                <TemporaryConnection
                    v-if="temporaryConnection.temporaryConnection.value"
                    :connection="temporaryConnection.temporaryConnection.value"
                />
            </slot>
        </svg>

        <div class="node-container" :style="nodeContainerStyle">
            <transition-group name="fade">
                <template v-for="(node, idx) in nodes" :key="node.id + counter.toString()">
                    <slot
                        name="node"
                        :node="node"
                        :selected="selectedNodeSet.has(node)"
                        :dragging="dragMoves[idx].dragging.value"
                        :visible="visibleNodeIds.has(node.id)"
                        @select="selectNode(node)"
                        @start-drag="startDrag"
                    >
                        <Node
                            :node="node"
                            :selected="selectedNodeSet.has(node)"
                            :dragging="dragMoves[idx].dragging.value"
                            :visible="visibleNodeIds.has(node.id)"
                            @select="selectNode(node)"
                            @start-drag="startDrag"
                        />
                    </slot>
                </template>
            </transition-group>
        </div>

        <slot name="sidebar">
            <Sidebar v-if="viewModel.settings.sidebar.enabled" />
        </slot>

        <slot name="minimap">
            <Minimap v-if="viewModel.settings.enableMinimap" />
        </slot>

        <slot name="contextMenu" :context-menu="contextMenu">
            <ContextMenu
                v-if="viewModel.settings.contextMenu.enabled"
                v-model="contextMenu.show.value"
                :items="contextMenu.items.value"
                :x="contextMenu.x.value"
                :y="contextMenu.y.value"
                @click="contextMenu.onClick"
            />
        </slot>

        <div v-if="selectionBox.isSelecting" class="selection-box" :style="selectionBox.getStyles()" />
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, Ref, toRef, nextTick } from "vue";

import { AbstractNode, Connection } from "@baklavajs/core";
import { IBaklavaViewModel } from "../viewModel";
import { providePlugin, useDragMove, useGraph } from "../utility";
import { usePanZoom } from "./panZoom";
import {
    VIEWPORT_MARGIN_PX,
    aabbIntersectsRect,
    graphViewportInflated,
    isNodeCollapsed,
    nodeAxisAlignedBox,
} from "./viewportCulling";
import { provideTemporaryConnection } from "./temporaryConnection";
import { useContextMenu } from "./contextMenu";
import { useSelectionBox } from "./selectionBox";

import Background from "./Background.vue";
import Node from "../node/Node.vue";
import ConnectionWrapper from "../connection/ConnectionWrapper.vue";
import TemporaryConnection from "../connection/TemporaryConnection.vue";
import Sidebar from "../sidebar/Sidebar.vue";
import Minimap from "../components/Minimap.vue";
import NodePalette from "../nodepalette/NodePalette.vue";
import Toolbar from "../toolbar/Toolbar.vue";
import ContextMenu from "../contextmenu/ContextMenu.vue";

const props = defineProps<{ viewModel: IBaklavaViewModel }>();

const token = Symbol("EditorToken");

const viewModelRef = toRef(props, "viewModel") as unknown as Ref<IBaklavaViewModel>;
providePlugin(viewModelRef);

const el = ref<HTMLElement | null>(null);
provide("editorEl", el);

const nodes = computed(() => props.viewModel.displayedGraph.nodes);
const dragMoves = computed(() => props.viewModel.displayedGraph.nodes.map((n) => useDragMove(toRef(n, "position"))));
const connections = computed(() => props.viewModel.displayedGraph.connections);
const selectedNodes = computed(() => props.viewModel.displayedGraph.selectedNodes);
const selectedNodeSet = computed(() => new Set(props.viewModel.displayedGraph.selectedNodes));

const { graph } = useGraph();
const editorSize = ref({ w: 0, h: 0 });
let editorResizeObserver: ResizeObserver | null = null;

onMounted(() => {
    void nextTick(() => {
        if (!el.value) {
            return;
        }
        const sync = (width: number, height: number) => {
            editorSize.value = { w: width, h: height };
        };
        editorResizeObserver = new ResizeObserver((entries) => {
            const cr = entries[0]?.contentRect;
            if (cr) {
                sync(cr.width, cr.height);
            }
        });
        editorResizeObserver.observe(el.value);
        sync(el.value.clientWidth, el.value.clientHeight);
    });
});

onBeforeUnmount(() => {
    editorResizeObserver?.disconnect();
    editorResizeObserver = null;
});

const defaultNodeWidth = computed(() => props.viewModel.settings.nodes.defaultWidth);

const inflatedViewport = computed(() => {
    const { w, h } = editorSize.value;
    if (w <= 0 || h <= 0) {
        return null;
    }
    const g = graph.value;
    return graphViewportInflated(w, h, g.panning.x, g.panning.y, g.scaling, VIEWPORT_MARGIN_PX);
});

const visibleNodeIds = computed(() => {
    const ids = new Set<string>();
    const vp = inflatedViewport.value;
    const defaultW = defaultNodeWidth.value;
    if (!vp) {
        for (const n of nodes.value) {
            ids.add(n.id);
        }
        return ids;
    }
    for (let idx = 0; idx < nodes.value.length; idx++) {
        const n = nodes.value[idx];
        if (selectedNodeSet.value.has(n)) {
            ids.add(n.id);
            continue;
        }
        if (dragMoves.value[idx]?.dragging.value) {
            ids.add(n.id);
            continue;
        }
        const box = nodeAxisAlignedBox(n, defaultW);
        if (aabbIntersectsRect(box, vp)) {
            ids.add(n.id);
        }
    }
    return ids;
});

const nodeMap = computed(() => {
    const m = new Map<string, AbstractNode>();
    for (const n of nodes.value) {
        m.set(n.id, n);
    }
    return m;
});

const visibleConnections = computed(() => {
    const defaultW = defaultNodeWidth.value;
    const filterCollapsed = (c: Connection) => {
        const fromN = nodeMap.value.get(c.from.nodeId);
        const toN = nodeMap.value.get(c.to.nodeId);
        if (!fromN || !toN) {
            return false;
        }
        return !isNodeCollapsed(fromN) && !isNodeCollapsed(toN);
    };
    const vp = inflatedViewport.value;
    if (!vp) {
        return connections.value.filter(filterCollapsed);
    }
    return connections.value.filter((c) => {
        if (!filterCollapsed(c)) {
            return false;
        }
        const fromN = nodeMap.value.get(c.from.nodeId);
        const toN = nodeMap.value.get(c.to.nodeId);
        if (!fromN || !toN) {
            return false;
        }
        const b1 = nodeAxisAlignedBox(fromN, defaultW);
        const b2 = nodeAxisAlignedBox(toN, defaultW);
        return aabbIntersectsRect(b1, vp) || aabbIntersectsRect(b2, vp);
    });
});

const panZoom = usePanZoom();
const temporaryConnection = provideTemporaryConnection();
const contextMenu = useContextMenu(viewModelRef);
const selectionBox = useSelectionBox(el);

const nodeContainerStyle = computed(() => ({
    ...panZoom.styles.value,
}));

// Reason: https://github.com/newcat/baklavajs/issues/54
const counter = ref(0);
props.viewModel.editor.hooks.load.subscribe(token, (s) => {
    counter.value++;
    return s;
});

const onPointerMove = (ev: PointerEvent) => {
    panZoom.onPointerMove(ev);
    temporaryConnection.onMouseMove(ev);
};

const onPointerDown = (ev: PointerEvent) => {
    if (ev.button === 0) {
        if (selectionBox.onPointerDown(ev)) {
            return;
        }

        if (ev.target === el.value) {
            unselectAllNodes();
            panZoom.onPointerDown(ev);
        }
        temporaryConnection.onMouseDown();
    }
};

const onPointerUp = (ev: PointerEvent) => {
    panZoom.onPointerUp(ev);
    temporaryConnection.onMouseUp();
};

const keyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Tab") {
        ev.preventDefault();
    }
    props.viewModel.commandHandler.handleKeyDown(ev);
};

const keyUp = (ev: KeyboardEvent) => {
    props.viewModel.commandHandler.handleKeyUp(ev);
};

const selectNode = (node: AbstractNode) => {
    const isMultiSelectModifierPressed = ["Control", "Shift"].some((k) =>
        props.viewModel.commandHandler.pressedKeys.includes(k),
    );
    if (!isMultiSelectModifierPressed) {
        unselectAllNodes();
    }
    if (!selectedNodeSet.value.has(node)) {
        props.viewModel.displayedGraph.selectedNodes.push(node);
    } else if (isMultiSelectModifierPressed) {
        const idx = selectedNodes.value.indexOf(node);
        selectedNodes.value.splice(idx, 1);
    }
};

const unselectAllNodes = () => {
    props.viewModel.displayedGraph.selectedNodes = [];
};

const startDrag = (ev: PointerEvent) => {
    for (const selectedNode of props.viewModel.displayedGraph.selectedNodes) {
        const idx = nodes.value.indexOf(selectedNode);
        const dragMove = dragMoves.value[idx];
        dragMove.onPointerDown(ev);

        document.addEventListener("pointermove", dragMove.onPointerMove);
    }

    document.addEventListener("pointerup", stopDrag);
};

const stopDrag = () => {
    for (const selectedNode of props.viewModel.displayedGraph.selectedNodes) {
        const idx = nodes.value.indexOf(selectedNode);
        const dragMove = dragMoves.value[idx];
        dragMove.onPointerUp();

        document.removeEventListener("pointermove", dragMove.onPointerMove);
    }

    document.removeEventListener("pointerup", stopDrag);
};
</script>
