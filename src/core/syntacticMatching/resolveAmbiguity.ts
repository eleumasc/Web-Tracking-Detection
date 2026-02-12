import _ from "lodash";
import assert from "assert";
import { TokenGroupTree, TokenGroupTreeNode } from "./TokenGroupTree";

export function resolveAmbiguity(tree: TokenGroupTree): TokenGroupTree {
  return new TokenGroupTree(doResolveAmbiguity(tree.getRootNode()));
}

function doResolveAmbiguity(node: TokenGroupTreeNode): TokenGroupTreeNode {
  const { token, groups } = node;
  if (groups.length === 0) {
    return node;
  }
  const priorityScores = groups.map((group) =>
    getPriorityScore(group.transformName),
  );
  const selectedScore = _.min(priorityScores);
  const selectedGroups = groups.filter(
    (_, index) => priorityScores[index] === selectedScore,
  );
  assert(selectedGroups.length === 1, "Cannot resolve ambiguity");
  const [selectedGroup] = selectedGroups;
  return {
    token,
    groups: [
      {
        transformName: selectedGroup.transformName,
        children: selectedGroup.children.map((child) =>
          doResolveAmbiguity(child),
        ),
      },
    ],
  };
}

function getPriorityScore(transformName: string): number {
  switch (transformName) {
    default:
      return 0;
    case "fromQueryValues":
      return 1;
    case "split":
      return 2;
  }
}
