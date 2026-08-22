<template>
    <connection-view
        v-if="d"
        :x1="d.input[0]"
        :y1="d.input[1]"
        :x2="d.output[0]"
        :y2="d.output[1]"
        :state="status"
        is-temporary
    />
</template>

<script lang="ts">
import { computed, defineComponent, inject, nextTick, onMounted, ref, Ref } from "vue";

import ConnectionView from "./ConnectionView.vue";
import { ITemporaryConnection, TemporaryConnectionState } from "./connection";
import { getDomElements } from "./domResolver";
import { getPortCoordinates, resolveTemporaryConnectionPaint } from "./portCoordinates";
import { useTemporaryConnection } from "../editor/temporaryConnection";

export default defineComponent({
    components: {
        "connection-view": ConnectionView
    },
    props: {
        connection: {
            type: Object as () => ITemporaryConnection,
            required: true
        }
    },
    setup(props) {
        const editorEl = inject<Ref<HTMLElement | null>>("editorEl");
        if (!editorEl) {
            throw new Error("TemporaryConnection must be used within a BaklavaEditor");
        }

        const { cancelTemporaryConnection } = useTemporaryConnection();
        const layoutEpoch = ref(0);

        const status = computed(() => (props.connection ? props.connection.status : TemporaryConnectionState.NONE));

        const readPaint = () => {
            if (!props.connection) {
                return null;
            }
            const root = editorEl.value;
            if (!root) {
                return null;
            }
            const start = getPortCoordinates(getDomElements(props.connection.from, root));
            const endFromPort = props.connection.to
                ? getPortCoordinates(getDomElements(props.connection.to, root))
                : null;
            return resolveTemporaryConnectionPaint(
                start,
                endFromPort,
                props.connection.mx,
                props.connection.my,
                props.connection.from.isInput === true,
            );
        };

        const d = computed(() => {
            void layoutEpoch.value;
            return readPaint();
        });

        onMounted(() => {
            void nextTick(() => {
                if (readPaint() === null) {
                    cancelTemporaryConnection();
                    return;
                }
                layoutEpoch.value += 1;
            });
        });

        return { d, status };
    }
});
</script>
