import assert from "assert";
import { Token } from "./Token";

export interface TokenGroup {
  transformName: string;
  children: TokenGroupTreeNode[];
}

export interface TokenGroupTreeNode {
  token: Token;
  groups: TokenGroup[];
}

export class TokenGroupTree {
  protected readonly cache = new WeakMap<Token, TokenGroupTreeNode>();

  constructor(protected rootNode?: TokenGroupTreeNode) {}

  getRootNode(): TokenGroupTreeNode {
    assert(this.rootNode);
    return this.rootNode;
  }

  addToken(token: Token): void {
    this.doAddToken(token);
  }

  protected doAddToken(token: Token): TokenGroupTreeNode {
    if (!token.chain) {
      let { rootNode } = this;
      if (!rootNode) {
        rootNode = { token, groups: [] };
        this.rootNode = rootNode;
      } else {
        assert(token === rootNode.token);
      }
      return rootNode;
    }

    let node = this.cache.get(token);
    if (node) {
      return node;
    }

    const { groups: parentGroups } = this.doAddToken(token.chain);
    const transformName = token.transform.name;
    let group = parentGroups.find(
      (group) => group.transformName === transformName,
    );
    if (!group) {
      group = { transformName: transformName, children: [] };
      parentGroups.push(group);
    }

    const { children } = group;
    node = children.find((child) => child.token === token);
    if (!node) {
      node = { token, groups: [] };
      children.push(node);
    }
    this.cache.set(token, node);
    return node;
  }

  toTokenArray(node?: TokenGroupTreeNode): Token[] {
    if (!node) {
      return this.rootNode ? this.toTokenArray(this.rootNode) : [];
    }

    const { token, groups } = node;
    if (groups.length === 0) {
      return [token];
    } else {
      return groups.flatMap((group) =>
        group.children.flatMap((child) => this.toTokenArray(child)),
      );
    }
  }

  static fromTokenArray(tokenArray: Token[]): TokenGroupTree {
    const tokenGroupTree = new TokenGroupTree();
    for (const token of tokenArray) {
      tokenGroupTree.addToken(token);
    }
    return tokenGroupTree;
  }
}
