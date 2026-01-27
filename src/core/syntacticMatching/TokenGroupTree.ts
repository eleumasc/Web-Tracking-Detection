import _ from "lodash";
import assert from "assert";
import { Token } from "./Token";

export interface TokenGroup {
  transformName: string;
  tokenEntries: TokenEntry[];
}

export interface TokenEntry {
  token: Token;
  children: TokenGroup[];
}

export class TokenGroupTree {
  protected readonly tokenEntryCache = new WeakMap<Token, TokenEntry>();

  constructor(protected rootTokenEntry?: TokenEntry) {}

  getRootTokenEntry() {
    return this.rootTokenEntry;
  }

  addToken(token: Token): void {
    this.doAddToken(token);
  }

  protected doAddToken(token: Token): TokenEntry {
    if (!token.chain) {
      let { rootTokenEntry } = this;
      if (!rootTokenEntry) {
        rootTokenEntry = { token, children: [] };
        this.rootTokenEntry = rootTokenEntry;
      } else {
        assert(token === rootTokenEntry.token);
      }
      return rootTokenEntry;
    }

    let tokenEntry = this.tokenEntryCache.get(token);
    if (tokenEntry) {
      return tokenEntry;
    }

    const { children: parentChildren } = this.doAddToken(token.chain);
    const transformName = token.transform.name;
    let tokenGroup = parentChildren.find(
      (group) => group.transformName === transformName,
    );
    if (!tokenGroup) {
      tokenGroup = { transformName: transformName, tokenEntries: [] };
      parentChildren.push(tokenGroup);
    }

    const { tokenEntries } = tokenGroup;
    tokenEntry = tokenEntries.find((tokenEntry) => tokenEntry.token === token);
    if (!tokenEntry) {
      tokenEntry = { token, children: [] };
      tokenEntries.push(tokenEntry);
    }
    this.tokenEntryCache.set(token, tokenEntry);
    return tokenEntry;
  }

  toTokenArray(tokenEntry?: TokenEntry): Token[] {
    if (!tokenEntry) {
      return this.rootTokenEntry ? this.toTokenArray(this.rootTokenEntry) : [];
    }

    const { token, children } = tokenEntry;
    if (children.length === 0) {
      return [token];
    } else {
      return children.flatMap((child) =>
        child.tokenEntries.flatMap((childTokenEntry) =>
          this.toTokenArray(childTokenEntry),
        ),
      );
    }
  }
}

export function applyPriority(tree: TokenGroupTree): TokenGroupTree {
  const rootTokenEntry = tree.getRootTokenEntry();
  return new TokenGroupTree(rootTokenEntry && doApplyPriority(rootTokenEntry));
}

function doApplyPriority(tokenEntry: TokenEntry): TokenEntry {
  const { token, children } = tokenEntry;
  if (children.length === 0) {
    return tokenEntry;
  }
  const priorityScores = children.map((child) =>
    getPriorityScore(child.transformName),
  );
  const selectedScore = _.min(priorityScores);
  const selectedChildren = children.filter(
    (_, index) => priorityScores[index] === selectedScore,
  );
  assert(selectedChildren.length === 1, "Ambiguous format");
  const [selectedChild] = selectedChildren;
  return {
    token,
    children: [
      {
        transformName: selectedChild.transformName,
        tokenEntries: selectedChild.tokenEntries.map((childTokenEntry) =>
          doApplyPriority(childTokenEntry),
        ),
      },
    ],
  };
}

function getPriorityScore(transformName: string): number {
  switch (transformName) {
    default:
      return 1;
    case "fromQueryValues":
      return 2;
    case "split":
      return 3;
  }
}
