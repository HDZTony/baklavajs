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
import { computed, onBeforeUnmount, onMounted, provide, Ref, ref, toRef } from "vue";

import { AbstractNode, Connection } from "@baklavajs/core";
import { IBaklavaViewModel } from "../viewModel";
import { providePlugin, useDragMove } from "../utility";
import { usePanZoom } from "./panZoom";
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

const triggerViewportUpdate = ref(0);

const viewportBounds = computed(() => {
    void triggerViewportUpdate.value;
    const g = props.viewModel.displayedGraph;
    const scaling = g.scaling;
    const panning = g.panning;
    if (!el.value) return null;
    const viewWidth = el.value.clientWidth;
    const viewHeight = el.value.clientHeight;
    return {
        minX: -panning.x - viewWidth / scaling,
        maxX: -panning.x,
        minY: -panning.y - viewHeight / scaling,
        maxY: -panning.y,
    };
});

const visibleNodeIds = computed(() => {
    const bounds = viewportBounds.value;
    if (!bounds) return new Set(nodes.value.map((n) => n.id));
    const margin = 500;
    const defaultWidth = props.viewModel.settings.nodes.defaultWidth;
    const s = new Set<string>();
    for (const n of nodes.value) {
        const p = n.position;
        if (!p) {
            s.add(n.id);
            continue;
        }
        const w = n.width ?? defaultWidth;
        if (
            p.x + w + margin >= bounds.minX &&
            p.x - margin <= bounds.maxX &&
            p.y + 400 + margin >= bounds.minY &&
            p.y - margin <= bounds.maxY
        ) {
            s.add(n.id);
        }
    }
    return s;
});

const nodeMap = computed(() => {
    const m = new Map<string, AbstractNode>();
    for (const n of nodes.value) {
        m.set(n.id, n);
    }
    return m;
});

const visibleConnections = computed(() => {
    const bounds = viewportBounds.value;
    if (!bounds) return connections.value;
    const padding = 500;
    const nm = nodeMap.value;
    return connections.value.filter((conn: Connection) => {
        const fromNode = nm.get(conn.from.nodeId);
        const toNode = nm.get(conn.to.nodeId);
        if (!fromNode || !toNode) return false;
        if (fromNode.collapsed || toNode.collapsed) return false;
        const fp = fromNode.position;
        const tp = toNode.position;
        if (!fp || !tp) return true;
        if (fp.x + padding < bounds.minX && tp.x + padding < bounds.minX) return false;
        if (fp.x > bounds.maxX + padding && tp.x > bounds.maxX + padding) return false;
        if (fp.y + padding < bounds.minY && tp.y + padding < bounds.minY) return false;
        if (fp.y > bounds.maxY + padding && tp.y > bounds.maxY + padding) return false;
        return true;
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

let editorResizeObserver: ResizeObserver | null = null;

onMounted(() => {
    if (el.value) {
        editorResizeObserver = new ResizeObserver(() => {
            triggerViewportUpdate.value++;
        });
        editorResizeObserver.observe(el.value);
    }
});

onBeforeUnmount(() => {
    if (editorResizeObserver) {
        editorResizeObserver.disconnect();
        editorResizeObserver = null;
    }
});
</script>
