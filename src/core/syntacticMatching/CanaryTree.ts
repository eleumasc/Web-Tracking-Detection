import _ from "lodash";
import assert from "assert";
import { Token } from "./Token";
import { TokenGroupTree, TokenGroupTreeNode } from "./TokenGroupTree";
import { Transform } from "./Transform";

export interface Canary {
  transformChain: any[];
  value: string;
  originalValue: string;
}

export interface CanaryTreeStructure {
  rootNode: CanaryTreeNode;
  canaryNodes: CanaryTreeNode[];
  rejectedCanaryNodes: CanaryTreeNode[];
}

export interface CanaryTreeNode {
  parent?: CanaryTreeNode | undefined;
  children: CanaryTreeNode[];
  transform?: Transform;
  valueIndex: number;
  originalValue: string;
  inMatchTree: boolean;
  inStructureTree: boolean;
}

export class CanaryTree {
  protected constructor(
    readonly structure: CanaryTreeStructure,
    readonly values: string[],
  ) {}

  getRootNode(): CanaryTreeNode {
    return this.structure.rootNode;
  }

  getCanaryNodes(): CanaryTreeNode[] {
    return this.structure.canaryNodes;
  }

  getNodeValue(node: CanaryTreeNode): string {
    return this.values[node.valueIndex];
  }

  getMatchingStructureTreeNode(node: CanaryTreeNode): CanaryTreeNode {
    // note: root is always a structure tree node
    return node.inStructureTree
      ? node
      : this.getMatchingStructureTreeNode(node.parent!);
  }

  getStructureTreeLeaves(node: CanaryTreeNode): CanaryTreeNode[] {
    assert(node.inStructureTree);
    const children = node.children.filter((node) => node.inStructureTree);
    return children.length === 0
      ? [node]
      : children.flatMap((child) => this.getStructureTreeLeaves(child));
  }

  computeReversed(node: CanaryTreeNode, newValue: string): string {
    for (let parent; (parent = node.parent); node = parent) {
      const { transform } = node;
      assert(transform && transform.reverse);
      const input = this.getNodeValue(parent);
      try {
        newValue = transform.reverse(newValue, input);
      } catch (e) {
        throw new StateInvariantError(
          `Failed transform.reverse(): ${String(e)}`,
        );
      }
    }
    return newValue;
  }

  update(newInitialValue: string): CanaryTree {
    const { values: oldValues } = this;

    const newValues = [...oldValues];
    (function doUpdate(node: CanaryTreeNode, newInput?: string): void {
      let newValue: string;
      if (!node.parent) {
        newValue = newInitialValue;
      } else {
        const { transform } = node;
        try {
          newValue = transform!.apply(newInput!);
        } catch (e) {
          throw new StateInvariantError(
            `Failed transform.apply(): ${String(e)}`,
          );
        }
      }

      const oldValue = oldValues[node.valueIndex];
      if (newValue === oldValue) {
        // tree rooted at node is unchanged
        return;
      }

      newValues[node.valueIndex] = newValue;

      for (const child of node.children) {
        doUpdate(child, newValue);
      }
    })(this.getRootNode());

    return new CanaryTree(this.structure, newValues);
  }

  rejectCanaryNode(node: CanaryTreeNode): CanaryTree {
    const {
      structure: { rootNode, canaryNodes, rejectedCanaryNodes },
      values,
    } = this;
    const newCanaryNodes = canaryNodes.filter(
      (canaryNode) => canaryNode !== node,
    );
    const newrejectedCanaryNodes = [...rejectedCanaryNodes, node];
    return new CanaryTree(
      {
        rootNode,
        canaryNodes: newCanaryNodes,
        rejectedCanaryNodes: newrejectedCanaryNodes,
      },
      values,
    );
  }

  getCanaries(): Canary[] {
    return this.createCanaries(this.structure.canaryNodes);
  }

  getRejectedCanaries(): Canary[] {
    return this.createCanaries(this.structure.rejectedCanaryNodes);
  }

  protected createCanaries(canaryNodes: CanaryTreeNode[]): Canary[] {
    return canaryNodes.map((canaryNode): Canary => {
      const transformChain: any[] = [];
      for (
        let cur: CanaryTreeNode = canaryNode;
        cur.transform;
        cur = cur.parent!
      ) {
        transformChain.push({ ...cur.transform });
      }
      return {
        transformChain,
        value: this.getNodeValue(canaryNode),
        originalValue: canaryNode.originalValue,
      };
    });
  }

  static create(
    matchTokenArray: Token[],
    structureTree: TokenGroupTree,
  ): CanaryTree {
    const matchTree = TokenGroupTree.fromTokenArray(matchTokenArray);
    const matchTreeRootNode = matchTree.getRootNode();
    const structureTreeRootNode = structureTree.getRootNode();
    assert(matchTreeRootNode.token.value === structureTreeRootNode.token.value);

    const values: string[] = [];
    const canaryNodes: CanaryTreeNode[] = [];
    const rootNode = (function createNode(
      matchTreeNode: TokenGroupTreeNode | undefined,
      structureTreeNode: TokenGroupTreeNode | undefined,
      parent?: CanaryTreeNode,
    ): CanaryTreeNode {
      assert(matchTreeNode || structureTreeNode);
      const matchOrStructureTreeNode = (matchTreeNode || structureTreeNode)!;
      const { token } = matchOrStructureTreeNode;
      const { transform, value: originalValue } = token;

      const valueIndex = values.length;
      values[valueIndex] = originalValue;

      const children: CanaryTreeNode[] = [];
      const node: CanaryTreeNode = {
        parent,
        children,
        transform,
        valueIndex,
        originalValue,
        inMatchTree: Boolean(matchTreeNode),
        inStructureTree: Boolean(structureTreeNode),
      };

      if (matchTreeNode && structureTreeNode) {
        const matchChildren = matchTreeNode.groups.flatMap(
          (group) => group.children,
        );
        const structureChildren = structureTreeNode.groups.flatMap(
          (group) => group.children,
        );
        const innerChildrenPairs = matchChildren.flatMap(
          (matchChild): [TokenGroupTreeNode, TokenGroupTreeNode][] => {
            const { value: matchValue, transform: matchTransform } =
              matchChild.token;
            const structureChild = structureChildren.find((structureChild) => {
              const { value: structureValue, transform: structureTransform } =
                structureChild.token;
              return (
                structureValue === matchValue &&
                _.isEqual(structureTransform, matchTransform)
              );
            });
            return structureChild ? [[matchChild, structureChild]] : [];
          },
        );
        const outerMatchChildren = _.difference(
          matchChildren,
          innerChildrenPairs.map((pair) => pair[0]),
        );
        const outerStructureChildren = _.difference(
          structureChildren,
          innerChildrenPairs.map((pair) => pair[1]),
        );

        for (const [matchChild, structureChild] of innerChildrenPairs) {
          const child = createNode(matchChild, structureChild, node);
          children.push(child);
        }
        for (const matchChild of outerMatchChildren) {
          const child = createNode(matchChild, undefined, node);
          children.push(child);
        }
        for (const structureChild of outerStructureChildren) {
          const child = createNode(undefined, structureChild, node);
          children.push(child);
        }
      } else {
        const matchOrStructureChildren =
          matchOrStructureTreeNode.groups.flatMap((group) => group.children);
        for (const matchOrStructureChild of matchOrStructureChildren) {
          const child = matchTreeNode
            ? createNode(matchOrStructureChild, undefined, node)
            : createNode(undefined, matchOrStructureChild, node);
          children.push(child);
        }
      }

      if (matchTreeNode && matchTokenArray.includes(matchTreeNode.token)) {
        canaryNodes.push(node);
      }

      return node;
    })(matchTreeRootNode, structureTreeRootNode);

    return new CanaryTree(
      { rootNode, canaryNodes, rejectedCanaryNodes: [] },
      values,
    );
  }
}

export class StateInvariantError extends Error {
  constructor(message?: string) {
    super(message);
  }
}
