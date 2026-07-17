import type { AbstractNode, NodeInterface } from "@baklavajs/core";

export interface IResolvedDomElements {
    node: HTMLElement | null;
    interface: HTMLElement | null;
    port: HTMLElement | null;
}

export function getDomElementById(id: string, root: ParentNode = document): HTMLElement | null {
    if (root === document) {
        return document.getElementById(id);
    }
    return root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
}

export function getDomElementOfNode(node: AbstractNode, root: ParentNode = document): HTMLElement | null {
    return getDomElementById(node.id, root);
}

export function getDomElements(ni: NodeInterface, root: ParentNode = document): IResolvedDomElements {
    const interfaceDOM = getDomElementById(ni.id, root);
    const portDOM = interfaceDOM?.getElementsByClassName("__port");

    return {
        node: interfaceDOM?.closest(".baklava-node") ?? null,
        interface: interfaceDOM,
        port: portDOM && portDOM.length > 0 ? (portDOM[0] as HTMLElement) : null,
    };
}
