import type { IResolvedDomElements } from "./domResolver";

export function getPortCoordinates(resolved: IResolvedDomElements): [number, number] {
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
    } else {
        return [0, 0];
    }
}
