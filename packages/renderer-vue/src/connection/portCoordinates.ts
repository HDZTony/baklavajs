import type { IResolvedDomElements } from "./domResolver";

export type PortPoint = [number, number];

export function getPortCoordinates(resolved: IResolvedDomElements): PortPoint | null {
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
    return null;
}

/**
 * Temporary-connection paint in graph space.
 * Returns null when the source port is unresolved — never paint at the graph origin.
 */
export function resolveTemporaryConnectionPaint(
    start: PortPoint | null,
    endFromPort: PortPoint | null,
    mx: number | undefined,
    my: number | undefined,
    fromIsInput: boolean,
): { input: PortPoint; output: PortPoint } | null {
    if (!start) {
        return null;
    }
    const end: PortPoint =
        endFromPort ?? (mx !== undefined && my !== undefined ? [mx, my] : start);
    if (fromIsInput) {
        return { input: end, output: start };
    }
    return { input: start, output: end };
}
