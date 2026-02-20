export class HostnameSuffixMap {
  protected root: TrieNode = new TrieNode();

  constructor(hostnames: string[]) {
    for (const hostname of hostnames) {
      this.insert(this.normalize(hostname));
    }
  }

  public includes(hostname: string): boolean {
    const labels = this.normalize(hostname).split(".").reverse();
    let node = this.root;

    for (const label of labels) {
      if (!node.children.has(label)) {
        return false;
      }

      node = node.children.get(label)!;

      if (node.isTerminal) {
        return true;
      }
    }

    return node.isTerminal;
  }

  protected insert(hostname: string): void {
    const labels = hostname.split(".").reverse();
    let node = this.root;

    for (const label of labels) {
      if (!node.children.has(label)) {
        node.children.set(label, new TrieNode());
      }
      node = node.children.get(label)!;
    }

    node.isTerminal = true;
  }

  protected normalize(hostname: string): string {
    return hostname.trim().toLowerCase().replace(/\.$/, "");
  }
}

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isTerminal: boolean = false;
}
